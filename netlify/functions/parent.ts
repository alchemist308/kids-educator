import { createNetlifyFamilyStore } from "../../server/family-store.ts";
import { createParentHandler } from "../../server/parent-service.ts";

const handle = createParentHandler(createNetlifyFamilyStore());
export default (request: Request, context: { ip?: string }) =>
  handle(request, context.ip ?? "unknown");
