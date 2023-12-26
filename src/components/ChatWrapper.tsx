import { ChevronDown } from "lucide-react"
import { Button } from "./ui/button"


const ChatWrapper = () => {
  return (
    <div className='w-full bg-white rounded-md shadow flex flex-col items-center'>
       <div className='h-14 w-full border-b border-zinc-200 flex items-center justify-between px-2'>
         <div className='flex items-center gap-1.5'>
         {/* <Button disabled={currPage <= 1} onClick={() => {setCurrPage((prev) => prev - 1 > 1 ? prev - 1 : 1 )
          setValue('page', String(currPage - 1))}} variant='ghost' aria-label='previous page'>
            <ChevronDown className='h-4 w-4' />
          </Button> */}
         </div>
       </div>
    </div>
  )
}

export default ChatWrapper