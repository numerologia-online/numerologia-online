// Red Flag: question titles and prices are public; paid author texts stay server-side.
import { reduce22 } from "./redflag-profile.js?v=1";
import { PUBLIC_CATEGORIES, PUBLIC_QUESTIONS } from "./redflag-public-catalog.js?v=redflag-catalog-refresh-20261109b";

const AUTH_BASE = "https://xn--c1adkkdfjbp1a4l.online";
const publicRequests = new Map();
const ownerRequests = new Map();
const fullBankRequests = new Map();
const publishedLoveDates = new Set(["31-1", "1-2", "2-2", "3-2", "4-2", "5-2", "6-2", "7-2", "8-2", "9-2", "10-2", "11-2", "12-2", "13-2", "14-2", "15-2", "16-2", "17-2", "18-2", "19-2", "20-2", "21-2", "22-2", "23-2", "24-2", "25-2", "26-2", "27-2", "28-2", "29-2", "1-3", "2-3", "3-3", "4-3", "5-3", "6-3", "7-3", "8-3", "9-3", "10-3", "11-3", "12-3", "13-3", "14-3", "15-3", "16-3", "17-3", "18-3", "19-3", "20-3", "21-3", "22-3", "23-3", "24-3", "25-3", "26-3", "27-3", "28-3", "29-3", "30-3", "31-3", "1-4", "2-4", "3-4", "4-4", "5-4", "6-4", "7-4", "8-4", "9-4", "10-4", "11-4", "12-4", "13-4", "14-4", "15-4", "16-4", "18-4", "19-4", "20-4", "1-5", "2-5", "3-5", "4-5", "5-5", "7-5", "8-5"]);

const accessError = (code, status) => Object.assign(new Error(code), { code, status });
const initData = () => {
  const telegram = globalThis.Telegram?.WebApp?.initData;
  if (typeof telegram === "string" && telegram) return telegram;
  try {
    return new URLSearchParams(globalThis.location?.hash?.replace(/^#/, "") || "").get("tgWebAppData") || "";
  } catch {
    return "";
  }
};

// Only intentionally public resources (free answers) use this path.
const publicJson = (path) => {
  const clean = path.split("?")[0].replace(/^.\//, "");
  if (!publicRequests.has(clean)) {
    const request = fetch(new URL("./" + clean, import.meta.url), { cache: "no-cache" })
      .then((response) => {
        if (!response.ok) throw accessError("FREE_CONTENT_UNAVAILABLE", response.status);
        return response.json();
      }).catch((error) => { publicRequests.delete(clean); throw error; });
    publicRequests.set(clean, request);
  }
  return publicRequests.get(clean);
};

// The authenticated REG.RU server returns complete paid data only to the owner
// until a verified payment ledger is connected. Never put a private token here.
const ownerJson = (path, dateKey = "") => {
  const key = initData() + ":" + path + (dateKey ? ":" + dateKey : "");
  if (!ownerRequests.has(key)) {
    const request = fetch(AUTH_BASE + "/api/numi-redflag-content.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ init_data: initData(), path, ...(dateKey ? { date_key: dateKey } : {}) }),
      cache: "no-store",
      signal: AbortSignal.timeout(25000)
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok || (data && data.ok === false)) {
        const code = response.status === 401 || response.status === 403
          ? "PURCHASE_REQUIRED" : "PRIVATE_CONTENT_UNAVAILABLE";
        throw accessError(code, response.status);
      }
      return data;
    }).catch((error) => { ownerRequests.delete(key); throw error; });
    ownerRequests.set(key, request);
  }
  return ownerRequests.get(key);
};
const privateQuestion = async (bankName, id) => {
  const session = initData();
  if (!session) throw accessError("PURCHASE_REQUIRED", 401);
  const cacheKey = session + ":" + bankName;
  const bankFile = bankName === "money" ? "money-questions" : bankName;
  if (!fullBankRequests.has(cacheKey)) {
    const request = ownerJson("data/redflag/banks/" + bankFile + ".json")
      .catch((error) => { fullBankRequests.delete(cacheKey); throw error; });
    fullBankRequests.set(cacheKey, request);
  }
  const bank = await fullBankRequests.get(cacheKey);
  const question = bank.questions?.find((item) => item.id === id);
  if (!question) throw accessError("PRIVATE_CONTENT_UNAVAILABLE");
  return question;
};
const approvedLoveAnswer = async (question, profile, free) => {
  const { day, month } = profile.classic.birthDate;
  const dateKey = day + "-" + month;
  if (!publishedLoveDates.has(dateKey)) return null;
  const path = "data/redflag/love/published/" + dateKey + ".json";
  let published;
  try {
    published = free ? await publicJson(path) : await ownerJson(path);
  } catch (error) {
    if (free) return null; // The free base text remains a valid fallback.
    throw error;
  }
  if (published.schemaVersion !== 1 || published.dateKey !== dateKey) {
    throw accessError("PRIVATE_CONTENT_UNAVAILABLE");
  }
  const text = published.entries?.[question.id];
  if (typeof text !== "string" || !text.trim()) {
    if (free) return null;
    throw accessError("PRIVATE_CONTENT_UNAVAILABLE");
  }
  return { answer: text };
};
const calculateAnswer = async (bankName, publicQuestion, free, profile) => {
  if (bankName === "love" && publicQuestion.id === "romance") {
    // All 366 dates are served from one protected JSONL bank; the API
    // selects only this person's date after server-side entitlement checks.
    const { day, month } = profile.classic.birthDate;
    const dateKey = day + "-" + month;
    const selected = await ownerJson("data/redflag/love/romance.jsonl", dateKey);
    if (selected.questionId !== "romance" || selected.dateKey !== dateKey ||
        typeof selected.answer !== "string" || !selected.answer.trim()) {
      throw accessError("ANSWER_NOT_FOUND");
    }
    return { answer: selected.answer };
  }
  if (publicQuestion.status === "in-progress") {
    throw accessError("CONTENT_NOT_PUBLISHED");
  }
  // The first question in each section is deliberately free. All other
  // details are fetched from private storage AFTER the click, never for lists.
  const question = free
    ? publicQuestion
    : await privateQuestion(bankName, publicQuestion.id);
  if (bankName === "love") {
    const approved = await approvedLoveAnswer(question, profile, free);
    if (approved) return approved;
  }
  if (question.textFile) {
    const path = "data/redflag/" + question.textFile.split("?")[0];
    const bank = free ? await publicJson(path) : await ownerJson(path);
    if (bank.questionId !== question.id || !["reduce22(day)-month", "day-month"].includes(bank.keyRule)) {
      throw accessError("INVALID_ANSWER_BANK");
    }
    const { day, month } = profile.classic.birthDate;
    const key = (bank.keyRule === "day-month" ? day : reduce22(day)) + "-" + month;
    const text = bank.entries?.[key];
    if (typeof text !== "string" || !text.trim()) throw accessError("ANSWER_NOT_FOUND");
    return { answer: text };
  }
  if (!question.variants) {
    throw accessError("CONTENT_NOT_PUBLISHED");
  }
  const variant = question.variants[profile[question.aspect]] || Object.values(question.variants)[0];
  if (!variant || typeof variant.answer !== "string") {
    throw accessError("ANSWER_NOT_FOUND");
  }
  return {
    verdict: variant.verdict,
    answer: variant.answer + (question.usePeriod ? " " + profile.periodNote : ""),
    observation: question.observation
  };
};
export const loadQuestionBank = async (bankName) => {
  const publicQuestions = PUBLIC_QUESTIONS[bankName];
  if (!Array.isArray(publicQuestions) || !publicQuestions.length) {
    throw accessError("PUBLIC_CATALOG_UNAVAILABLE");
  }
  return {
    QUESTIONS: publicQuestions.map((question, index) => ({
      id: question.id,
      title: question.title,
      priceRub: question.priceRub,
      status: question.status,
      answer: (profile) => calculateAnswer(bankName, question, index === 0, profile)
    }))
  };
};
export const loadCategoryCatalog = async () => PUBLIC_CATEGORIES.map(category => ({
  ...category,
  questionCount: PUBLIC_QUESTIONS[category.bank]?.length ?? 0
}));
