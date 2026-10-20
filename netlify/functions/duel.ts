import { createQuestionBankLoader } from "../../server/content-store.ts";
import { createDuelHandler } from "../../server/http.ts";
import {
  createNetlifyContentStorage,
  createNetlifyRoomStore,
} from "../../server/netlify-storage.ts";
import { createQuestionProvider } from "../../server/quest-service.ts";
import {
  createReadingBankLoader,
  READING_BANK_KEY,
} from "../../server/reading-store.ts";

const loadBank = createQuestionBankLoader(createNetlifyContentStorage());
const loadReading = createReadingBankLoader(
  createNetlifyContentStorage(READING_BANK_KEY),
);
export default createDuelHandler(
  createNetlifyRoomStore(),
  createQuestionProvider(loadBank, loadReading),
);
