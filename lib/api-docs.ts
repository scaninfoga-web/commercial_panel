import apiDocs from "@/data/api-docs.json";
import type { ApiDocumentation } from "@/types/api-documentation";

export function getApiDocumentation(endpoint: string): ApiDocumentation | undefined {
  const docs = apiDocs as ApiDocumentation[];
  return docs.find((doc) => doc.endpoint === endpoint);
}