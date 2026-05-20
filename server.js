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
    const telefono = req.body.From || "";
    const nombre = req.body.ProfileName || "";

    const totalImagenes = Number(req.body.NumMedia || 0);
    let imagenes = [];

    for (let i = 0; i < totalImagenes; i++) {
      imagenes.push({
        url: req.body[`MediaUrl${i}`],
        tipo: req.body[`MediaContentType${i}`]
      });
    }

    console.log("Mensaje recibido:", mensaje);
    console.log("Teléfono:", telefono);
    console.log("Nombre:", nombre);
    console.log("Imágenes recibidas:", imagenes);

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
  "intencion": "",
  "marca": "",
  "modelo": "",
  "version": "",
  "anio": "",
  "kilometraje": "",
  "precio": "",
  "ciudad": "",
  "factura": "",
  "comentarios": "",
  "faltantes": [],
  "prioridad": ""
}

Reglas:
- Si no detectas algún dato, déjalo vacío.
- Si el mensaje no trata de un auto, usa intencion: "otro".
- Si parece que quiere vender/ofrecer un auto, usa intencion: "ofrecer_auto".
- Si parece que busca comprar, usa intencion: "comprar_auto".
- En faltantes agrega datos importantes que no vengan: marca, modelo, año, kilometraje, precio, ciudad, factura o fotos.
- Si viene al menos una imagen, no agregues "fotos" como faltante.
- Prioridad alta si tiene marca, modelo, año, precio y fotos.
`
        },
        {
          role: "user",
          content: `
Mensaje de WhatsApp:
${mensaje}

Teléfono:
${telefono}

Nombre:
${nombre}

Cantidad de imágenes:
${totalImagenes}

URLs de imágenes:
${imagenes.map(img => img.url).join("\n")}
`
        }
      ]
    });

    let respuestaIA = completion.choices[0].message.content;

    console.log("Clasificación IA:", respuestaIA);

    let clasificacion;

    try {
      clasificacion = JSON.parse(
        respuestaIA
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim()
      );
    } catch (error) {
      clasificacion = {
        intencion: "error_parseo",
        comentarios: respuestaIA
      };
    }

    const resultado = {
      telefono,
      nombre,
      mensaje_original: mensaje,
      imagenes,
      total_imagenes: totalImagenes,
      clasificacion
    };

    console.log("Resultado final:", JSON.stringify(resultado, null, 2));

    res.status(200).send("ok");

  } catch (error) {
    console.error("Error en webhook:", error);
    res.status(500).send("error");
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor funcionando en puerto " + PORT);
});
