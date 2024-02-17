import { db } from "@/db";
import { pinecone } from "@/lib/pinecone";
import { SendMessageValidator } from "@/lib/validators/send-message-validator";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { NextRequest } from "next/server";
import { PineconeStore } from "langchain/vectorstores/pinecone"
import { openai } from "@/lib/openai";
import { OpenAIStream, StreamingTextResponse } from "ai"

export const POST = async (req: NextRequest) => {
    // Endpoint to asking a question to the PDF file
    const body = await req.json()

    const { getUser } = getKindeServerSession()
    const user = await getUser()

    if (!user) {
        return new Response('Unauthorized', { status: 401 })
    }

    const {id: userId } = user

    // Validate The Body Data
    const { fileId, message } = SendMessageValidator.parse(body)

    const file = await db.file.findFirst({
        where: {
            id: fileId,
            userId
        }
    })

    if (!file) return new Response('Not found', { status: 404 })

    await db.message.create({
        data: {
            text: message,
            isUserMessage: true,
            userId,
            fileId
        }
    })

    // Vectorize the message so we know what PDF vectorized page best match the message
    const embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY
      })

      const pineconeIndex = pinecone.Index("paper-threads")

      const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
        pineconeIndex,
        // Search for the most relevant page to answer to this message
        namespace: file.id
      })

      const results = await vectorStore.similaritySearch(message, 4)

      // Get Previous Messages
      const prevMessages = await db.message.findMany({
        where: {
            fileId
        },
        orderBy: {
            createdAt: 'asc'
        },
        take: 6
      })

      const formattedPrevMessages = prevMessages.map((msg) => ({
        role: msg.isUserMessage ? 'user' as const : 'assistant' as const,
        content: msg.text
      }))

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        temperature: 0,
        stream: true,
        messages: [
          {
            role: 'system',
            content:
              'Use the following pieces of context (or previous conversaton if needed) to answer the users question in markdown format.',
          },
          {
            role: 'user',
            content: `Use the following pieces of context (or previous conversaton if needed) to answer the users question in markdown format. \nIf you don't know the answer, just say that you don't know, don't try to make up an answer.
            
           \n----------------\n
      
          PREVIOUS CONVERSATION:
          ${formattedPrevMessages.map((message) => {
          if (message.role === 'user')
            return `User: ${message.content}\n`
            return `Assistant: ${message.content}\n`
         })}
      
          \n----------------\n
      
         CONTEXT:
         ${results.map((r) => r.pageContent).join('\n\n')}
      
          USER INPUT: ${message}`,
           },
        ],
      })

      // Display the assistant message as chunks while being generated
      const stream = OpenAIStream(response, {
        async onCompletion(completion) {
            await db.message.create({
                data: {
                    text: completion,
                    isUserMessage: false,
                    fileId,
                    userId
                }
            })
        },
      })

      return new StreamingTextResponse(stream)
    }