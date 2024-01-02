import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { privateProcedure, publicProcedure, router } from './trpc';
import { TRPCError } from '@trpc/server';
import { db } from '@/db';
import { z } from "zod"
import { INFINITE_QUERY_LIMIT } from '@/config/infinite-query';
import { absoluteUrl } from '@/lib/utils';
import { getUserSubscriptionPlan, stripe } from '@/lib/stripe';
import { PLANS } from '@/config/stripe';

export const appRouter = router({
  //------------------------------//CREATE THE KINDEAUTH USER IN THE DATABASE//--------------------//
   authCallback: publicProcedure.query(async () => {
     const { getUser } = getKindeServerSession()
     const user = await getUser()

     if (!user || !user.email) throw new TRPCError({code: "UNAUTHORIZED"})

     // Check If The User Is In The Database
     const dbUser = await db.user.findFirst({
      where: {
        id: user.id
      }
     })

     if (!dbUser) {
       await db.user.create({
        data: {
          id: user.id,
          email: user.email
        }
       })
     }
     
     return { success: true }
   }),
   //------------------------------------------//GET USER FILES//----------------------------------//
   getUserFiles: privateProcedure.query(async ({ ctx }) => {
      // Get Current User and UserId From PrivateProcedure Middleware
     const { userId, user } = ctx

     // Return User Files
     return await db.file.findMany({
      where: {
        userId
      }
     })
   }),
   //------------------------------------------//GET UPLOAD STATUS//--------------------------------//
   getFileUploadStatus: privateProcedure.input(z.object({ fileId: z.string() })).query(async ({ ctx, input }) => {
      const file = await db.file.findFirst({
        where: {
          id: input.fileId,
          userId: ctx.userId
        }
      })

      if (!file) return { status: "PENDING" as const }

      return { status: file.uploadStatus }
   }),
   //-------------------------------//GET FILE MESSAGES WITH INFINITE SCROLLING//---------------------//
    getFileMessages: privateProcedure.input(z.object({
       limit: z.number().min(1).max(100).nullish(),
       cursor: z.string().nullish(),
       fileId: z.string()
      })).query(async ({ ctx, input }) => {
        const { userId } = ctx
        const { fileId, cursor } = input

        // Infinite scrolling 
        const limit = input.limit ?? INFINITE_QUERY_LIMIT

        const file = await db.file.findFirst({
          where: {
            id: fileId,
            userId
          }
        })

        if (!file) throw new TRPCError({ code: 'NOT_FOUND' })

        // Take the limit of messages + 1 for smooth infinite scrolling
        const messages = await db.message.findMany({
          take: limit + 1,
          where: {
            fileId
          },
          orderBy: {
            createdAt: 'desc'
          },
          cursor: cursor ? { id: cursor }: undefined,
          select: {
            id: true,
            isUserMessage: true,
            createdAt: true,
            text: true
          }
        })

        let nextCursor: typeof cursor | undefined = undefined
        if (messages.length > limit) {
          const nextItem = messages.pop()
          nextCursor = nextItem?.id
        }

        return {
          messages,
          nextCursor
        }
      }),
    //------------------------------------------//GET FILE//---------------------------------------//
    getFile: privateProcedure.input(z.object({ key: z.string() })).mutation(async ({ ctx, input }) => {
       const { userId } = ctx

       const file = await db.file.findFirst({
        where: {
          key: input.key,
          userId
        }
       })

       if (!file) throw new TRPCError({code: 'NOT_FOUND'})

       return file
    }),
    //-----------------------------------------//DELETE FILE//-------------------------------------//
    deleteFile: privateProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
       const { userId } = ctx

       // Input Is What We Request To The Frontend
       const file = await db.file.findFirst({
        where: {
          id: input.id,
          userId
        }
       })

       if (!file) throw new TRPCError({ code: 'NOT_FOUND' })

       await db.file.delete({
        where: {
          id: input.id,
        }
       })

       return file
    }),

    //----------------------------------------------//STRIPE//-------------------------------------//
    createStripeSession: privateProcedure.mutation(async ({ ctx }) => {
      const { userId } = ctx

      const billingUrl = absoluteUrl("/dashboard/billing")

      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" })

      const dbUser = await db.user.findFirst({
        where: {
          id: userId
        }
      })

      if (!dbUser) throw new TRPCError({ code: "UNAUTHORIZED" })

      const subscriptionPlan = await getUserSubscriptionPlan()

      // If The User Is Already Subscribed
      if (subscriptionPlan.isSubscribed && dbUser.stripeCustomerId) {
        const stripeSession = await stripe.billingPortal.sessions.create({
           customer: dbUser.stripeCustomerId,
           return_url: billingUrl
        })

        return { url: stripeSession.url }
      }

      // If The User Is Not Subscribed
      const stripeSession = await stripe.checkout.sessions.create({
        success_url: billingUrl,
        cancel_url: billingUrl,
        customer_email: dbUser.email,
        payment_method_types: ["card", "paypal"],
        mode: "subscription",
        billing_address_collection: "auto",
        line_items: [
          {
            // Use price.priceIds.production In Production
            price: PLANS.find((plan) => plan.name === "Pro")?.price.priceIds.test,
            quantity: 1
          }
        ],
        metadata: {
          userId: userId
        }
      })

      return { url: stripeSession.url }
    })
});

export type AppRouter = typeof appRouter;