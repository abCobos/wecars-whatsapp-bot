const express = require("express");
const OpenAI = require("openai");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.get("/", (req, res) => {
  res.send("WeCars WhatsApp Bot funcionando");
});

app.post("/webhook", async (req, res) => {

  try {

    const mensaje = req.body.Body || "";

    console.log("Mensaje recibido:", mensaje);

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `
Extrae información de vehículos usados en México.

Devuelve SOLO JSON válido.

Formato:
{
 "marca":"",
 "modelo":"",
 "version":"",
 "anio":"",
 "kilometraje":"",
 "precio":"",
 "comentarios":""
}
`
        },
        {
          role: "user",
          content: mensaje
        }
      ]
    });

    console.log(completion.choices[0].message.content);

    res.send("ok");

  } catch (error) {

    console.log(error);

    res.status(500).send("error");
  }

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor funcionando en puerto " + PORT);
});