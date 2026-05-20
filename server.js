const express = require("express");
const OpenAI = require("openai");
const axios = require("axios");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.get("/", (req, res) => {
  res.send("WeCars WhatsApp Bot + Monday funcionando");
});

async function crearItemMonday(datos) {
  const columnValues = {
    text_mm3hz3ps: datos.marca || "",
    text_mm3hnpfp: datos.modelo || "",
    text_mm3h4yrh: datos.version || "",
    numeric_mm3h6v7: datos.anio ? Number(datos.anio) : null,
    numeric_mm3h45jr: datos.kilometraje ? Number(datos.kilometraje) : null,
    numeric_mm3ha16x: datos.precio ? Number(datos.precio) : null,
    text_mm3hx5k: datos.ciudad || "",
    text_mm3hdqs4: datos.factura || "",
    phone_mm3hh4n: {
      phone: datos.telefono || "",
      countryShortName: "MX"
    },
    long_text_mm3hvzwc: datos.comentarios || "",
    color_mm3htx5t: {
      label: "Pendiente"
    }
  };

  const query = `
    mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
      create_item (
        board_id: $boardId,
        item_name: $itemName,
        column_values: $columnValues
      ) {
        id
      }
    }
  `;

  const variables = {
    boardId: process.env.MONDAY_BOARD_ID,
    itemName: `${datos.marca || "AUTO"} ${datos.modelo || ""} ${datos.anio || ""}`.trim(),
    columnValues: JSON.stringify(columnValues)
  };

  const response = await axios.post(
    "https://api.monday.com/v2",
    {
      query,
      variables
    },
    {
      headers: {
        Authorization: process.env.MONDAY_API_KEY,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data;
}

app.post("/webhook", async (req, res) => {
  try {
    const mensaje = req.body.Body || "";
    const telefono = req.body.From || "";
    const nombre = req.body.ProfileName || "";

    const totalImagenes = Number(req.body.NumMedia || 0);
    const imagenes = [];

    for (let i = 0; i < totalImagenes; i++) {
      imagenes.push({
        url: req.body[`MediaUrl${i}`],
        tipo: req.body[`MediaContentType${i}`]
      });
    }

    console.log("Mensaje recibido:", mensaje);
    console.log("Teléfono:", telefono);
    console.log("Nombre:", nombre);
    console.log("Imágenes:", imagenes);

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
- Si parece que quieren vender/ofrecer un auto, usa intencion: "ofrecer_auto".
- Si el mensaje no trata de un auto, usa intencion: "otro".
- Si viene al menos una imagen, no pongas "fotos" como faltante.
- Prioridad alta si trae marca, modelo, año, precio y fotos.
`
        },
        {
          role: "user",
          content: `
Mensaje:
${mensaje}

Teléfono:
${telefono}

Nombre:
${nombre}

Cantidad de imágenes:
${totalImagenes}

Imágenes:
${imagenes.map(img => img.url).join("\n")}
`
        }
      ]
    });

    let respuestaIA = completion.choices[0].message.content;

    respuestaIA = respuestaIA
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let clasificacion;

    try {
      clasificacion = JSON.parse(respuestaIA);
    } catch (error) {
      clasificacion = {
        intencion: "error_parseo",
        comentarios: respuestaIA
      };
    }

    console.log("Clasificación IA:", clasificacion);

    if (clasificacion.intencion === "ofrecer_auto") {
      const resultadoMonday = await crearItemMonday({
        marca: clasificacion.marca,
        modelo: clasificacion.modelo,
        version: clasificacion.version,
        anio: clasificacion.anio,
        kilometraje: clasificacion.kilometraje,
        precio: clasificacion.precio,
        ciudad: clasificacion.ciudad,
        factura: clasificacion.factura,
        telefono: telefono.replace("whatsapp:", ""),
        comentarios: `
Nombre: ${nombre}
Mensaje original: ${mensaje}
Comentarios IA: ${clasificacion.comentarios || ""}
Faltantes: ${(clasificacion.faltantes || []).join(", ")}
Prioridad: ${clasificacion.prioridad || ""}
Imágenes: ${imagenes.map(img => img.url).join(" | ")}
`
      });

      console.log("Item creado en Monday:", resultadoMonday);
    }

    res.status(200).send("ok");

  } catch (error) {
    console.error("Error en webhook:", error.response?.data || error.message);
    res.status(500).send("error");
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor funcionando en puerto " + PORT);
});
