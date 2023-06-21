import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import Layout from '@/components/layout';
import styles from '@/styles/Home.module.css';
import { Message } from '@/types/chat';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import LoadingDots from '@/components/ui/LoadingDots';
import { Document } from 'langchain/document';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import Sidebar from '@/components/sidebar';
import datasetData from '../data.json'
import Link from 'next/link';

export default function Home() {
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [sourceDocs, setSourceDocs] = useState<Document[]>([]);
  const [allfiles, setallFiles] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedTempFiles, SetSelectedTempFiles] = useState<File[]>([]);
  const [SelectedTempFilesCount,SetSelectedTempFilesCount] = useState(0)
  const [error, setError] = useState<string | null>(null);
  const [messageState, setMessageState] = useState<{
    messages: Message[];
    pending?: string;
    history: [string, string][];
    pendingSourceDocs?: Document[];
  }>({
    messages: [
      {
        message: 'Hi, what would you like to learn about this doc?',
        type: 'apiMessage',
      },
    ],
    history: [],
    pendingSourceDocs: [],
  });

  const { messages, pending, history, pendingSourceDocs } = messageState;

  const messageListRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const [selectedDataset, setSelectedDataset] = useState('');
  const[nav , setNav] = useState(false)

  const handleDatasetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target;
    setSelectedDataset(value);
  };
  
  useEffect(() => {
    textAreaRef.current?.focus();
  }, []);

  //handle form submission
  async function handleSubmit(e: any) {
    e.preventDefault();

    setError(null);

    if (!query) {
      alert('Please input a question');
      return;
    }

    const question = query.trim();

    setMessageState((state) => ({
      ...state,
      messages: [
        ...state.messages,
        {
          type: 'userMessage',
          message: question,
        },
      ],
      pending: undefined,
    }));

    setLoading(true);
    setQuery('');
    setMessageState((state) => ({ ...state, pending: '' }));

    const ctrl = new AbortController();

    try {
      fetchEventSource('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          history,
          selectedTempFiles,
          SelectedTempFilesCount,
          filterOptionEnabled,
        }),
        signal: ctrl.signal,
        onmessage: (event) => {
          if (event.data === '[DONE]') {
            setMessageState((state) => ({
              history: [...state.history, [question, state.pending ?? '']],
              messages: [
                ...state.messages,
                {
                  type: 'apiMessage',
                  message: state.pending ?? '',
                  sourceDocs: state.pendingSourceDocs,
                },
                
              ],
              pending: undefined,
              pendingSourceDocs: undefined,
            }));
            setLoading(false);
            ctrl.abort();
          } else {
            const data = JSON.parse(event.data);
            if (data.sourceDocs) {
              setMessageState((state) => ({
                ...state,
                pendingSourceDocs: data.sourceDocs,
              }));
            } else {
              setMessageState((state) => ({
                ...state,
                pending: (state.pending ?? '') + data.data,
              }));
            }
          }
        },
        
      });
    } catch (error) {
      setLoading(false);
      setError('An error occurred while fetching the data. Please try again.');
    }
  }

  //prevent empty submissions
  const handleEnter = useCallback(
    (e: any) => {
      if (e.key === 'Enter' && query) {
        handleSubmit(e);
      } else if (e.key == 'Enter') {
        e.preventDefault();
      }
    },
    [query],
  );

  const chatMessages = useMemo(() => {
    return [
      ...messages,
      ...(pending
        ? [
            {
              type: 'apiMessage',
              message: pending,
              sourceDocs: pendingSourceDocs,
            },
          ]
        : []),
    ];
  }, [messages, pending, pendingSourceDocs]);

  //scroll to bottom of chat
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [chatMessages]);


  const getFiles = async () => {
    try {
      const response = await fetch("/api/upload");
      const data = await response.json();
      setallFiles(data.files);
    } catch (error: any) {
      console.log(error.response?.data);
    }
  };

  const deleteFile = async (fileName: any) => {
    try {
      const response = await fetch(`/api/upload?fileName=${fileName}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (response.ok) {
        getFiles()
      } else {
        setErrorMessage(data.error);
      }
    } catch (error: any) {
      console.log(error.response?.data);
    }
  }

  useEffect(() => {
    getFiles()
  }, []);

  const handleCheckboxChange = (file: File) => {
    let updatedSelectedTempFiles: File[] = [];
    let count = 0;
  
    if (selectedTempFiles.includes(file)) {
      updatedSelectedTempFiles = selectedTempFiles.filter((item) => item !== file);
    } else {
      updatedSelectedTempFiles = [...selectedTempFiles, file];
    }
  
    count = updatedSelectedTempFiles.length;
    
    // Update the state with the updatedSelectedTempFiles and count
    SetSelectedTempFiles(updatedSelectedTempFiles);
    SetSelectedTempFilesCount(count);
  };

  const handleNav = () => {
    setNav(!nav);
  };

  const [filterOptionEnabled, setFilterOptionEnabled] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/filterControl');
        const data = await response.json();
        setFilterOptionEnabled(!(data.filterEnabled));
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchData();
  }, []);

  // Perform some action with the boolean value
  console.log('Received boolean value:', filterOptionEnabled);


  return (
    <> 
    <div className='flex flex-row'>
      {/* Mobile Nav */}

      {/* slider*/}
      <div className={nav? 'h-full fixed z-20 w-[85%] bg-slate-200 px-4 py-5  flex flex-col justify-between space-y-5 items-center' : 'hidden absolute left-[-100%]'}>
        <button onClick={handleNav} className='absolute top-0 right-0 bg-blue-400 p-2 w-8 h-8 flex items-center justify-center'>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" className='fill-black'><path d="m16.192 6.344-4.243 4.242-4.242-4.242-1.414 1.414L10.535 12l-4.242 4.242 1.414 1.414 4.242-4.242 4.243 4.242 1.414-1.414L13.364 12l4.242-4.242z"></path></svg>
        </button>
        {filterOptionEnabled ? <>
          <div>
            <div className="rounded-md mx-4 bg-black text-white px-2 py-2 mb-2 text-center flex justify-between">
              <h1 className='mr-3'>Filter from Documents</h1><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" className='fill-white'><path d="M13 20v-4.586L20.414 8c.375-.375.586-.884.586-1.415V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v2.585c0 .531.211 1.04.586 1.415L11 15.414V22l2-2z"></path></svg>
            </div>
            {/* <h1 className=" text-center text-black font-bold my-3">Filter from Uploaded Documents</h1> */}
            <ul className="text-black px-4 overflow-y-auto h-[500px] custom-scrollbar">
        {allfiles.map((file) => (
          <li className="space-x-6 flex items-center my-1 justify-between border-b-2 border-gray-300 py-1" key={file}>
            <div className="font-semibold md:text-[13px]">
          {file}{" "}
          </div>
          <input
            type="checkbox"
            checked={selectedTempFiles.includes(file)}
            onChange={() => handleCheckboxChange(file)}
            className="ml-2 w-5 h-5"
          />         
          </li>
        ))}
      </ul>
            </div>

            <div className="flex flex-row w-full justify-center mt-5">
                <button onClick={handleNav} className="rounded-md mx-4 bg-blue-400 text-white px-4 py-2 mb-2 hover:bg-blue-500">Done</button>
            </div>
        </>
        :
        <>
        <h1 className=' text-center font-semibold'>QA Chatbot for custom docs</h1>
        </>}
            
      </div>

      {/* end mobile nav */}

      {filterOptionEnabled ?
      <>
            <div className="hidden md:flex h-screen w-[400px] bg-slate-200 px-4 py-10  md:flex-col justify-between space-y-5">
                

                <div>
                <div className="rounded-md mx-4 bg-black text-white px-2 py-2 mb-2 text-center">Filter from Documents</div>
                {/* <h1 className=" text-center text-black font-bold my-3">Filter from Uploaded Documents</h1> */}
                <ul className="text-black px-4 overflow-y-auto h-[500px] custom-scrollbar">
            {allfiles.map((file) => (
              <li className="space-x-6 flex items-center my-1 justify-between border-b-2 border-gray-300 py-1" key={file}>
                <div className="font-semibold md:text-[13px]">
                <input
                type="checkbox"
                checked={selectedTempFiles.includes(file)}
                onChange={() => handleCheckboxChange(file)}
                className="mr-2"
              />
              {file}{" "}
                </div>
              </li>
            ))}
          </ul>
                </div>
    
                <div className="flex flex-row justify-center mt-5">
                    {/* <Link href="/ingest">
                    <div className="rounded-md mx-4 bg-blue-400 text-white px-4 py-2 mb-2 hover:bg-blue-500">Ingest more documents</div>
                    </Link> */}
                </div>
            </div>
      </>
    :
    <>
    </>}
      <Layout>
        <div className="mx-auto flex flex-col gap-4">
          <div className='w-full flex flex-row justify-between md:justify-center p-4 items-center'>

          <button onClick={handleNav} className='bg-gray-900 p-2 flex items-center justify-center md:hidden'>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" className='fill-white'><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"></path></svg>
        </button>
          <h1 className="md:text-2xl text-lg font-bold leading-[1.1] tracking-wide text-center">
            QA Chatbot for Custom Docs
          </h1>
          </div>
          <main className={styles.main}>
            <div className={styles.cloud}>
              <div ref={messageListRef} className={styles.messagelist}>
                {chatMessages.map((message, index) => {
                  let icon;
                  let className;
                  if (message.type === 'apiMessage') {
                    icon = (
                      <Image
                        src="/bot-image.png"
                        alt="AI"
                        width="40"
                        height="40"
                        className={styles.boticon}
                        priority
                      />
                    );
                    className = styles.apimessage;
                  } else {
                    icon = (
                      <Image
                        src="/usericon.png"
                        alt="Me"
                        width="40"
                        height="40"
                        className={styles.usericon}
                        priority
                      />
                    );
                    // The latest message sent by the user will be animated while waiting for a response
                    className =
                      loading && index === chatMessages.length - 1
                        ? styles.usermessagewaiting
                        : styles.usermessage;
                  }
                  return (
                    <>
                      <div key={`chatMessage-${index}`} className={className}>
                        {icon}
                        <div className={styles.markdownanswer}>
                          <div dangerouslySetInnerHTML={{
                __html: message.message.replaceAll("\n", "<br />"),
              }} />
                            {/* {message.message} */}
                        </div>
                      </div>
                      {message.sourceDocs && (
                        <div
                          className="p-5"
                          key={`sourceDocsAccordion-${index}`}
                        >
                          <Accordion
                            type="single"
                            collapsible
                            className="flex-col"
                          >
                            {message.sourceDocs.map((doc, index) => (
                              <div key={`messageSourceDocs-${index}`}>
                                <AccordionItem value={`item-${index}`}>
                                  <AccordionTrigger>
                                    <h3>Source</h3>
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    {/* <ReactMarkdown linkTarget="_blank">
                                      {doc.pageContent}
                                    </ReactMarkdown> */}
                                    <p className="mt-2">
                                      <b>Source:</b> <a href={`/docs/${doc.metadata.pdf_name}`} target="_blank">{doc.metadata.pdf_name}</a>
                                    </p>
                                  </AccordionContent>
                                </AccordionItem>
                              </div>
                            ))}
                          </Accordion>
                        </div>
                      )}
                    </>
                  );
                })}
                {sourceDocs.length > 0 && (
                  <div className="p-5">
                    <Accordion type="single" collapsible className="flex-col">
                      {sourceDocs.map((doc, index) => (
                        <div key={`SourceDocs-${index}`}>
                          <AccordionItem value={`item-${index}`}>
                            <AccordionTrigger>
                              <h3>Source {index + 1}</h3>
                            </AccordionTrigger>
                            <AccordionContent>
                              <ReactMarkdown linkTarget="_blank">
                                {doc.metadata.pdf_name}
                              </ReactMarkdown>
                            </AccordionContent>
                          </AccordionItem>
                        </div>
                      ))}
                    </Accordion>
                  </div>
                )}
              </div>
            </div>
            <div className={styles.center}>
              <div className={styles.cloudform}>
                <form onSubmit={handleSubmit}>
                  <textarea
                    disabled={loading}
                    onKeyDown={handleEnter}
                    ref={textAreaRef}
                    autoFocus={false}
                    rows={1}
                    maxLength={512}
                    id="userInput"
                    name="userInput"
                    placeholder={
                      loading
                        ? 'Waiting for response...'
                        : 'What is this doc about?'
                    }
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className={styles.textarea}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className={styles.generatebutton}
                  >
                    {loading ? (
                      <div className={styles.loadingwheel}>
                        <LoadingDots color="#000" />
                      </div>
                    ) : (
                      // Send icon SVG in input field
                      <svg
                        viewBox="0 0 20 20"
                        className={styles.svgicon}
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path>
                      </svg>
                    )}
                  </button>
                </form>
              </div>
            </div>
            {error && (
              <div className="border border-red-400 rounded-md p-4">
                <p className="text-red-500">{error}</p>
              </div>
            )}
          </main>
        </div>
      </Layout>
      </div>
    </>
  );
}
