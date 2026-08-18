declare module "wordnet-db" {
  const wordnet: {
    libVersion: string;
    version: string;
    path: string;
    files: string[];
  };
  export = wordnet;
}
