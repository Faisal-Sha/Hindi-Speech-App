const express = require("express");
const cors = require("cors");
require('dotenv').config();
const { OpenAI } = require("openai");

const app = express();
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

app.use(cors());
app.use(express.json());

app.post("/chat", async(req, res) => {
    try {
        const { message } = req.body;
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo", 
            messages: [
                {
                    role: "system", 
                    content: "आप एक सहायक हैं जो हिंदी में उत्तर देते हैं। कृपया पूरा और विस्तृत उत्तर दें। अपने उत्तर को बीच में न काटें।"
                }, 
                {
                    role: "user", 
                    content: message
                }
            ], 
            max_tokens: 1000
        })

        const aiResponse = completion.choices[0].message.content;

        res.json({ response: aiResponse });

    } catch (error) {
        console.log("Error: ", error);
        res.json({response: 'माफ करें, कुछ गलत हुआ है।'})
    }
})

app.listen(3001, () => {
    console.log("AI Backend running on port 3001");
})