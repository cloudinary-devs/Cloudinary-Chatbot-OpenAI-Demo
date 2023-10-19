import express from "express";
import bodyParser from "body-parser";
import OpenAI from "openai";
import "dotenv/config";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log(process.env.OPENAI_API_KEY)

const app = express();
app.use(bodyParser.json());

app.post("/api/chat", async (req, res) => {
  /*
    Train the model by giving it some previous conversations
    */
  const demoModel = [
    {
      role: "user",
      content:
        "Hi, can you tell me where to find information about the Cloudinary React sdk?",
    },
    {
      role: "assistant",
      content:
        "Yes, the conentent can be found inside of this website https://cloudinary.com/documentation/react_integration",
    },
    {
      role: "user",
      content:
        "can you tell me where to find information about the cloudinary transformations",
    },
    {
      role: "assistant",
      content:
        "Yes, the conentent can be found inside of this website https://cloudinary.com/documentation/react_image_transformations",
    },
    {
      role: "user",
      content: "can you tell me how to display an image using the cloudinary React SDK",
    },
    {
      role: "assistant",
      content: `Yes, to display an image using cloudinary follow this guide https://cloudinary.com/documentation/react_integration#landingpage and this code sample
      import React from 'react'
      import {AdvancedImage} from '@cloudinary/react';
      import {Cloudinary} from "@cloudinary/url-gen";
      
      // Import required actions.
      import {sepia} from "@cloudinary/url-gen/actions/effect";
      
      const App = () => {
      
        // Create and configure your Cloudinary instance.
        const cld = new Cloudinary({
          cloud: {
            cloudName: 'demo'
          }
        }); 
      
        // Use the image with public ID, 'front_face'.
        const myImage = cld.image('front_face');
      
        // Apply the transformation.
        myImage
        .effect(sepia());  // Apply a sepia effect.
      
        // Render the transformed image in a React component.
        return (
          <div>
            <AdvancedImage cldImg={myImage} />
          </div>
        )
      };
        `,
    },
  ];

  const { messages } = req.body;
  messages[messages.length - 1].content = `${
    messages[messages.length - 1].content
  }.`;

  /**
   * Call the OpenAI SDK and get a response
   */
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [...messages, ...demoModel], // pass the new message and the previous messages
    });
    console.log(response);
    res.json(response.choices[0].message);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * Generate a random animal avatar
 * using DALLE
 */
app.post("/api/avatar", async (req, res) => {
  const requestData = {
    prompt: `generate picture of animal`,
    n: 2,
    size: "256x256",
  };

  try {
    const response = await fetch(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(requestData),
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log("Response:", data);
      res.json(data.data);
    } else {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const PORT = 6000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
