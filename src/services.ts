import dotenv from 'dotenv';
import fetch from 'node-fetch';
import runes from 'runes';
import { Configuration, OpenAIApi } from 'openai';
dotenv.config();

export const PRODUCTION_MODE = process.env.RAILWAY_ENVIRONMENT === 'production';

const { OPENAI_TOKEN, GEOLOCATION_APIKEY } = process.env;
// Mock APIs if we're not in production or app mode is testing
const MOCK_APIS = (!PRODUCTION_MODE || process.env.APP_MODE === 'testing');

if (!OPENAI_TOKEN && !MOCK_APIS) throw new Error('OPENAI_TOKEN not set');
if (!GEOLOCATION_APIKEY && !MOCK_APIS) throw new Error('GEOLOCATION_APIKEY not set');

/* ------- CINEMA API ------- */
// Cinema API endpoints are never mocked

// Endpoints
export const CONFITERIAS_ENDPOINT = (cinema_id: string) => (
  `https://api.cinemark-peru.com/api/vista/ticketing/concession/items?cinema_id=${cinema_id}`
);
export const BILLBOARD_ENDPOINT = (cinema_id: string) => (
  `https://api.cinemark-peru.com/api/vista/data/billboard?cinema_id=${cinema_id}`
);
export const THEATRES_ENDPOINT = 'https://api.cinemark-peru.com/api/vista/data/theatres';

export const CINEMARK_MOVIE_THUMBNAIL = (corporate_film_id: string) => (
  `https://cinemarkmedia.modyocdn.com/pe/300x400/${corporate_film_id}.jpg`
);

const apiHeaders = {
  "accept": "*/*",
  "accept-encoding": "gzip, deflate, br",
  "accept-language": "en-US,en;q=0.9,es;q=0.8",
  "cookie": "_gid=GA1.2.1654558725.1675482711; _cinemark-la_session=eyJzZXNzaW9uX2lkIjoiNzBiZDc3YzFjMWFlNzJmYjNkNGRkZmJmNzZhNTY4NDAiLCJfY3NyZl90b2tlbiI6IkJsd1VneFh1RmdDOXNrdFBlRUhnK3EyOVRBaVpTTlQrSlBzb2ljbWlDOGM9In0%3D--59840d1adf401bbe6eb5cc5a07ea6ddcd9ca0e05; _gcl_au=1.1.1751685644.1675558059; _clck=k556qf|1|f8x|0; _gat_UA-125280698-1=1; _clsk=1wvq1p7|1675733502038|25|1|j.clarity.ms/collect; _ga_NCVH5X9JM1=GS1.1.1675731854.10.1.1675733509.52.0.0; _ga=GA1.1.1413784692.1675482711",
  "referer": "https://www.cinemark-peru.com/",
  "sec-ch-ua-platform": "OpenBSD",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  "user-agent": "Mozilla/5.0 (X11; OpenBSD i386) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/43.0.2357.81 Safari/537.36",
  "x-requested-with": "XMLHttpRequest",
}

export async function apifetch<T>(url: string, method: string = 'GET') {
  try {
    const response = await fetch(url, { method, headers: apiHeaders });
    const data = (await response.json()) as T;
    return data;
  }
  catch {
    return null;
  }
}

/* ------- OPENAI API ------- */

const configuration = new Configuration({ apiKey: OPENAI_TOKEN });
const openai = new OpenAIApi(configuration);

type OpenaiMovie = { title: string, description: string, }

const CONVERT_MOVIE_TO_EMOJIS_PROMPT = (movie: OpenaiMovie) => (
`This is a game! Given the title and descripcion of two movies, represent each of them with 5 flat emojis.

----------
1) FROZEN:
Anna se une a Kristoff, un alpinista extremo, y a su reno, Sven, en un viaje épico donde se toparán con místicos Trolls, un divertido muñeco de nieve llamado Olaf, y temperaturas extremas, en una aventura por hallar a su hermana: la princesa Elsa.
----------
five flat emojis: ⛄🏰👸🏔️🥶

----------
2) ${movie.title}:
${movie.description}
----------
five flat emojis:`);

export const EMOJIS_NOT_FOUND = '❓❓❓❓❓';

export async function movieToEmojisIA({ title, description } : { title: string, description: string }) {
  if (MOCK_APIS) return '⛄🏰👸🏔️🥶';

  let response: Awaited<ReturnType<typeof openai.createCompletion>>;
  try {
    response = await openai.createCompletion({
      model: "text-davinci-002",
      prompt: CONVERT_MOVIE_TO_EMOJIS_PROMPT({ title, description }),
      temperature: 0.27,
      max_tokens: 500,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });
  }
  catch (e) {
    // docs: https://www.npmjs.com/package/openai#user-content-error-handling
    console.error(e);
    throw e;
  }

  const emojis = response.data.choices[0].text.trim();
  return runes.substr(emojis, 0, 5);
}

/* ------- GEOLOCATION API ------- */

interface IPLookup {
  ip: string;
  country_code2: string;
  country_code3: string;
  country_name: string;
  state_prov: string;
  district: string;
  city: string;
  zipcode: string;
  latitude: string;
  longitude: string;
}

const geolocationMockResponse = (ip: string) => ({
  ip: ip,
  country_code2: "PE",
  country_code3: "PER",
  country_name: "Peru",
  state_prov: "Lima",
  district: "",
  city: "Lima",
  zipcode: "15048",
  latitude: "-12.10925",
  longitude: "-77.01641"
});

export async function ipLookupLocation(ip: string) {
  if (MOCK_APIS) return geolocationMockResponse(ip);

  const data = await fetch(
    `https://api.ipgeolocation.io/ipgeo?apiKey=${GEOLOCATION_APIKEY}&ip=${ip}&fields=geo`
  );
  const lookup = (await data.json()) as IPLookup;

  return lookup;
}
