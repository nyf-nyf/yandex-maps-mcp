export interface YandexMapsResponse {
  status: string;
  error_message?: string;
}

export interface GeocodeResponse extends YandexMapsResponse {
  response: {
    GeoObjectCollection: {
      metaDataProperty: {
        GeocoderResponseMetaData: {
          request: string;
          results: string;
          found: string;
        };
      };
      featureMember: Array<{
        GeoObject: {
          metaDataProperty: {
            GeocoderMetaData: {
              precision: string;
              text: string;
              kind: string;
              Address: {
                country_code: string;
                formatted: string;
                Components: Array<{
                  kind: string;
                  name: string;
                }>;
              };
              AddressDetails: {
                Country: {
                  AddressLine: string;
                  CountryNameCode: string;
                  CountryName: string;
                  AdministrativeArea?: {
                    AdministrativeAreaName: string;
                    Locality?: {
                      LocalityName: string;
                      Thoroughfare?: {
                        ThoroughfareName: string;
                        Premise?: {
                          PremiseNumber: string;
                        };
                      };
                    };
                  };
                };
              };
            };
          };
          description: string;
          name: string;
          boundedBy: {
            Envelope: {
              lowerCorner: string;
              upperCorner: string;
            };
          };
          Point: {
            pos: string;
          };
        };
      }>;
    };
  };
}

export interface ToolResult {
  content: Array<{
    type: "text" | "image";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}