import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { privateProcedure, publicProcedure, router } from './trpc';
import { TRPCError } from '@trpc/server';
import { db } from '@/db';
import { z } from "zod"

export const appRouter = router ({
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
});

export type AppRouter = typeof appRouter;