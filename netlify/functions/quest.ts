import { createQuestionBankLoader } from "../../server/content-store.ts";
import { createQuestHandler } from "../../server/http.ts";
import { createNetlifyContentStorage } from "../../server/netlify-storage.ts";
import {
  createReadingBankLoader,
  READING_BANK_KEY,
} from "../../server/reading-store.ts";

const loadBank = createQuestionBankLoader(createNetlifyContentStorage());
const loadReading = createReadingBankLoader(
  createNetlifyContentStorage(READING_BANK_KEY),
);
export default createQuestHandler(loadBank, loadReading);
