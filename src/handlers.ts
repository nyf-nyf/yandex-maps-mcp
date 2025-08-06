import fetch from "node-fetch";
import { URL } from "node:url";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { GeocodeResponse } from "./types.js";
import { YANDEX_MAPS_API_KEY, YANDEX_MAPS_STATIC_API_KEY, YANDEX_MAPS_GEOCODER_BASE_URL, YANDEX_MAPS_STATIC_BASE_URL } from "./config.js";

export async function handleGeocode(
  country: string, 
  lang: string, 
  state?: string, 
  city?: string, 
  district?: string, 
  street?: string, 
  house_number?: string
): Promise<CallToolResult> {
  const addressParts = [
    house_number,
    street,
    district,
    city,
    state,
    country
  ].filter(part => part !== undefined && part !== '');
  
  const address = addressParts.join(', ');

  const url = new URL(YANDEX_MAPS_GEOCODER_BASE_URL);
  url.searchParams.append("geocode", address);
  url.searchParams.append("format", "json");
  url.searchParams.append("results", "1");
  url.searchParams.append("lang", lang);
  url.searchParams.append("apikey", YANDEX_MAPS_API_KEY);

  const response = await fetch(url.toString());
  const data = await response.json() as GeocodeResponse;

  if ('error' in data) {
    return {
      content: [{
        type: "text",
        text: `Geocoding failed: ${(data as any).message || 'Unknown error'}`
      }],
      isError: true
    };
  }

  if (!data.response || data.response.GeoObjectCollection.featureMember.length === 0) {
    return {
      content: [{
        type: "text",
        text: `Geocoding failed: No results found`
      }],
      isError: true
    };
  }

  const geoObject = data.response.GeoObjectCollection.featureMember[0].GeoObject;
  const point = geoObject.Point?.pos.split(' ').map(Number);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        location: point ? { lng: point[0], lat: point[1] } : null,
        formatted_address: geoObject.metaDataProperty.GeocoderMetaData.text,
        address_components: geoObject.metaDataProperty.GeocoderMetaData.Address.Components
      }, null, 2)
    }],
    isError: false
  };
}

export async function handleReverseGeocode(
  latitude: number, 
  longitude: number, 
  lang: string
): Promise<CallToolResult> {
  const url = new URL(YANDEX_MAPS_GEOCODER_BASE_URL);
  url.searchParams.append("geocode", `${longitude},${latitude}`);
  url.searchParams.append("format", "json");
  url.searchParams.append("results", "1");
  url.searchParams.append("lang", lang);
  url.searchParams.append("apikey", YANDEX_MAPS_API_KEY);

  const response = await fetch(url.toString());
  const data = await response.json() as GeocodeResponse;

  if ('error' in data) {
    return {
      content: [{
        type: "text",
        text: `Reverse geocoding failed: ${(data as any).message || 'Unknown error'}`
      }],
      isError: true
    };
  }

  if (!data.response || data.response.GeoObjectCollection.featureMember.length === 0) {
    return {
      content: [{
        type: "text",
        text: `Reverse geocoding failed: No results found`
      }],
      isError: true
    };
  }

  const geoObject = data.response.GeoObjectCollection.featureMember[0].GeoObject;
  const point = geoObject.Point?.pos.split(' ').map(Number);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        location: point ? { lng: point[0], lat: point[1] } : null,
        formatted_address: geoObject.metaDataProperty.GeocoderMetaData.text,
        address_components: geoObject.metaDataProperty.GeocoderMetaData.Address.Components
      }, null, 2)
    }],
    isError: false
  };
}

export async function handleRenderMap(
  latitude: number,
  longitude: number,
  latitude_span: number,
  longitude_span: number,
  lang: string,
  placemarks?: Array<{ latitude: number, longitude: number }>
): Promise<CallToolResult> {
  const ll = `${longitude},${latitude}`;
  const spn = `${longitude_span},${latitude_span}`;

  const url = new URL(YANDEX_MAPS_STATIC_BASE_URL);
  url.searchParams.append("ll", ll);
  url.searchParams.append("spn", spn);
  url.searchParams.append("l", "map");
  url.searchParams.append("lang", lang);
  url.searchParams.append("apikey", YANDEX_MAPS_STATIC_API_KEY);
  
  if (placemarks && placemarks.length > 0) {
    const placemarksParam = placemarks
      .map(mark => `${mark.longitude},${mark.latitude},pm2rdm`)
      .join('~');
    
    url.searchParams.append("pt", placemarksParam);
  }

  try {
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const errorText = await response.text();
      return {
        content: [{
          type: "text",
          text: `Failed to fetch map image: ${response.status} ${response.statusText}\n${errorText}`
        }],
        isError: true
      };
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    const base64Data = imageBuffer.toString('base64');
    const contentType = response.headers.get('content-type') || 'image/png';
    
    return {
      content: [{
        type: "image",
        data: base64Data,
        mimeType: contentType
      }],
      isError: false
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error rendering map: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}