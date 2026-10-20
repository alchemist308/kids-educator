import { createQuestionBankLoader } from "../../server/content-store.ts";
import { createDuelHandler } from "../../server/http.ts";
import {
  createNetlifyContentStorage,
  createNetlifyRoomStore,
} from "../../server/netlify-storage.ts";
import { createQuestionProvider } from "../../server/quest-service.ts";

const loadBank = createQuestionBankLoader(createNetlifyContentStorage());
export default createDuelHandler(
  createNetlifyRoomStore(),
  createQuestionProvider(loadBank),
);
