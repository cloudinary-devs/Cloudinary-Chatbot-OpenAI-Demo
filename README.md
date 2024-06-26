![Cloudinary Developers](https://github.com/cloudinary-devs/.github/blob/main/assets/cloudinary-banner.png?raw=true)

<div align="center">
  <br />
  <a href="https://twitter.com/cloudinary" target="_blank">Twitter</a>
    <span>&nbsp;&nbsp;-&nbsp;&nbsp;</span>
  <a href="https://cloudinary.com/" target="_blank">Cloudinary</a>
    <span>&nbsp;&nbsp;-&nbsp;&nbsp;</span>
  <a href="https://cloudinary.com/documentation" target="_blank">Docs</a>
    <span>&nbsp;&nbsp;-&nbsp;&nbsp;</span>
  <a href="https://github.com/cloudinary-devs" target="_blank">Code Samples</a>
    <span>&nbsp;&nbsp;-&nbsp;&nbsp;</span>
  <a href="https://cloudinary.com/blog/" target="_blank">Blog</a>
    <span>&nbsp;&nbsp;-&nbsp;&nbsp;</span>
  <a href="https://community.cloudinary.com/" target="_blank">Community</a>
  <br />
  <hr />
</div>

# Cloudinary OpenAI Chatbot Sample

This sample app shows how to build and customize a a chatbot using [OpenAI APIs and SDK](https://platform.openai.com/docs/introduction). In this demo we also make use of DALLE for the generation of AI image to be used as avatars in the chat.

## Run this project

### Locally

- Clone this repo
- In the `.env` file enter your `OPENAI_API_KEY`.
- Add your environment variables in the `.env` file.
- Run `npm run start` to run your NodeJS server in the port 6000.
- In a separate terminal run `npm run dev` to run your React application.
- Open [http://localhost:3000/](http://localhost:3000/) in your browser.

## ChatBot Functionality - server.js

This code uses the [OpenAI SDK method **completions**](https://platform.openai.com/docs/guides/gpt/chat-completions-api) to generate a conversation using ChatGPT 3.5 for the conversationinal AI. We also provided a `demoModel` to train our chatbot to focus on content around the Cloudinary Developer documentation.

```javascript
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
```

## AI Images With DALLE - server.js

This code uses the the [Image Create endpoint](https://platform.openai.com/docs/api-reference/images) that uses DALLE in the background to generate the AI images (avatars) for the chatbot.

```javascript
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
```

## Cloudinary Community

Engage in collaborative coding, connect with fellow enthusiasts, and gather insights from a vibrant open-source network over on [Twitter](https://twitter.com/cloudinary), [Discord](https://discord.gg/cloudinary), or the [Community Forums](https://community.cloudinary.com/)

## Show your support

Give a ⭐️ if this project helped you, and watch this repo to stay up to date.
