import type { NextApiRequest, NextApiResponse } from 'next';
import { OpenAIEmbeddings } from 'langchain/embeddings';
import { PineconeStore } from 'langchain/vectorstores';
import { makeChain } from '@/utils/makechain';
import { pinecone } from '@/utils/pinecone-client';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';

import { PromptTemplate } from "langchain/prompts";
import { LLMChain } from "langchain/chains";
import { OpenAI } from "langchain/llms";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { question, history , selectedTempFiles , SelectedTempFilesCount } = req.body;

  if (!question) {
    return res.status(400).json({ message: 'No question in the request' });
  }
  // OpenAI recommends replacing newlines with spaces for best results
  const sanitizedQuestion = question.trim().replaceAll('\n', ' ');

  const index = pinecone.Index(PINECONE_INDEX_NAME);

  /* create vectorstore*/
  const vectorStore = await PineconeStore.fromExistingIndex(
    new OpenAIEmbeddings({}),
    {
      pineconeIndex: index,
      textKey: 'text',
      namespace: PINECONE_NAME_SPACE,
      filter: { pdf_name: { $in: selectedTempFiles } },
    },
  );

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });

  const sendData = (data: string) => {
    res.write(`data: ${data}\n\n`);
  };

  sendData(JSON.stringify({ data: '' }));

  //create chain
  const chain = makeChain(vectorStore, SelectedTempFilesCount, (token: string) => {
    sendData(JSON.stringify({ data: token }));
  });

  try {
    //Ask a question
    const Lresponse = await chain.call({
      question: sanitizedQuestion,
      chat_history:[],
    });

    const sourcedocs = (Lresponse.sourceDocuments);

const model = new OpenAI({ temperature: 0.9 , modelName : 'text-davinci-003' , streaming : true });
const prompt = PromptTemplate.fromTemplate(
  `Answer my """{question}""" using """{source}""". Please provide a well-described answer with full details. The answer should be well-structured and should have line brakes as an article. If the answer is a list provide well-ordered numeric list like 1\n 2\n 3\n \n`
);
const chainA = new LLMChain({ llm: model, prompt });

const response = 
await chainA.call({ question: {question} , source: {sourcedocs} });

    console.log('response', response);
    // console.log('Respo9nseB' , resB)
  console.log(Lresponse.sourceDocuments)
    sendData(JSON.stringify({ sourceDocs: Lresponse.sourceDocuments }));
  } catch (error) {
    console.log('error', error);
  } finally {
    sendData('[DONE]');
    res.end();
  }
}
