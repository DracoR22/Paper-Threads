'use client'

import { ChevronDown, ChevronLeft, Loader2, XCircle } from "lucide-react"
import { Button, buttonVariants } from "../ui/button"
import Messages from "./Messages"
import ChatInput from "./ChatInput"
import { trpc } from "@/app/_trpc/client"
import Link from "next/link"
import { ChatContextProvider } from "./ChatContext"

interface ChatWrapperProps {
  fileId: string
}


const ChatWrapper = ({ fileId }: ChatWrapperProps) => {

  // Backend Call
   const { data, isLoading } = trpc.getFileUploadStatus.useQuery({
    fileId
   }, {
    // get what we returned in the api route
    refetchInterval: (data) => data?.status === "SUCCESS" || data?.status === "FAILED" ? false : 500
   })

   if (isLoading) return (
    <div className="relative min-h-full bg-zinc-50 flex divide-y divide-zinc-200 flex-col justify-between gap-2">
      <div className="flex-1 flex justify-center items-center flex-col mb-28">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin"/>
          <h3 className="font-semibold text-xl">Loading...</h3>
          <p className="text-zinc-500 text-sm">
              We&apos;re preparing your PDF.
          </p> 
        </div>
      </div>

      <ChatInput isDisabled/>
    </div>
   )

   if (data?.status === "PROCESSING") return (
    <div className="relative min-h-full bg-zinc-50 flex divide-y divide-zinc-200 flex-col justify-between gap-2">
    <div className="flex-1 flex justify-center items-center flex-col mb-28">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin"/>
        <h3 className="font-semibold text-xl">Processing PDF...</h3>
        <p className="text-zinc-500 text-sm">
            This won&apos;t take long.
        </p> 
      </div>
    </div>

    <ChatInput isDisabled/>
  </div>
   )

   if (data?.status === "FAILED") return (
    <div className="relative min-h-full bg-zinc-50 flex divide-y divide-zinc-200 flex-col justify-between gap-2">
    <div className="flex-1 flex justify-center items-center flex-col mb-28">
      <div className="flex flex-col items-center gap-2">
        <XCircle className="h-8 w-8 text-red-500"/>
        <h3 className="font-semibold text-xl">Too many pages in PDF</h3>
        <p className="text-zinc-500 text-sm">
            your <span className="font-medium">Free</span> plan supports up to 5 pages per PDF
        </p> 
        <Link href='/dashboard' className={buttonVariants({
          variant: "secondary",
          className: "mt-4"
        })}>
          <ChevronLeft className="h-3 w-3 mr-1.5"/>
        </Link>
      </div>
    </div>

    <ChatInput isDisabled/>
  </div>
   )

  return (
    <ChatContextProvider fileId={fileId}>
    <div className='relative min-h-full bg-zinc-50 flex divide-y divide-zinc-200 flex-col justify-between gap-2'>
      <div className='flex-1 justify-between flex flex-col mb-28'>
        <Messages fileId={fileId}/> 
      </div>
      <ChatInput/>
    </div>
    </ChatContextProvider>
  )
}

export default ChatWrapper