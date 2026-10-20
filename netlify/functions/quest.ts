import { createQuestionBankLoader } from "../../server/content-store.ts";
import { createQuestHandler } from "../../server/http.ts";
import { createNetlifyContentStorage } from "../../server/netlify-storage.ts";

const loadBank = createQuestionBankLoader(createNetlifyContentStorage());
export default createQuestHandler(loadBank);
