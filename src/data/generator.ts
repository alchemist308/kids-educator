import { questions, type Question, type SubjectId } from "./questions.ts";

type Random = () => number;
type Difficulty = Question["difficulty"];
type Template = (random: Random, difficulty: Difficulty) => Question;

const subjectIds: SubjectId[] = [
  "math",
  "world",
  "russian",
  "english",
  "literature",
];
const normalize = (text: string) =>
  text.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();

/** Knowledge identity ignores seed, choice order and changing distractors. */
export function questionContentId(
  question: Pick<Question, "subject" | "prompt" | "choices" | "answer">,
): string {
  const content = JSON.stringify([
    question.subject,
    normalize(question.prompt),
    normalize(question.choices[question.answer]),
  ]);
  let first = 2166136261;
  let second = 2246822507;
  for (let index = 0; index < content.length; index += 1) {
    const code = content.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 3266489909);
  }
  return `q-${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

function rng(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
const integer = (random: Random, min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));
const pick = <T>(random: Random, values: readonly T[]): T =>
  values[integer(random, 0, values.length - 1)];
function shuffle<T>(random: Random, values: readonly T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = integer(random, 0, index);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function make(
  subject: SubjectId,
  prompt: string,
  correct: string,
  distractors: string[],
  explanation: string,
  difficulty: Difficulty,
): Question {
  const choices = [correct, ...distractors.filter((value) => value !== correct)]
    .filter((value, index, all) => all.indexOf(value) === index)
    .slice(0, 4);
  if (choices.length !== 4)
    throw new Error(`Template needs four distinct choices: ${prompt}`);
  const question: Question = {
    id: "",
    subject,
    prompt,
    choices,
    answer: 0,
    explanation,
    difficulty,
  };
  question.id = questionContentId(question);
  return question;
}

function numeric(
  subject: SubjectId,
  prompt: string,
  answer: number,
  explanation: string,
  difficulty: Difficulty,
  unit = "",
): Question {
  const offsets = [1, -1, 10, -10, 2, -2, 5, -5, 100];
  const alternatives = offsets
    .map((offset) => answer + offset)
    .filter((value) => value >= 0 && value !== answer);
  const label = (value: number) => `${value}${unit ? ` ${unit}` : ""}`;
  return make(
    subject,
    prompt,
    label(answer),
    alternatives.slice(0, 3).map(label),
    explanation,
    difficulty,
  );
}

export function pluralRu(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  const value = Math.abs(Math.trunc(count));
  if (value % 100 >= 11 && value % 100 <= 14) return many;
  return value % 10 === 1
    ? one
    : value % 10 >= 2 && value % 10 <= 4
      ? few
      : many;
}

const time = (minutes: number) =>
  `${Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;

const mathTemplates: Template[] = [
  (r, d) => {
    const a = integer(r, 20, d === 1 ? 80 : 300),
      b = integer(r, 3, 12),
      c = integer(r, 2, 9);
    const brackets = d === 3;
    const answer = brackets ? (a + b) * c : a + b * c;
    return numeric(
      "math",
      `Вычисли, соблюдая порядок действий: ${brackets ? `(${a} + ${b}) × ${c}` : `${a} + ${b} × ${c}`}.`,
      answer,
      brackets
        ? `Сначала скобки: ${a} + ${b} = ${a + b}. Затем ${a + b} × ${c} = ${answer}.`
        : `Сначала умножение: ${b} × ${c} = ${b * c}. Затем ${a} + ${b * c} = ${answer}.`,
      d,
    );
  },
  (r, d) => {
    const x = integer(r, 8, 60),
      divisor = integer(r, 2, 9),
      quotient = integer(r, 10, 25),
      extra = integer(r, 5, 35);
    if (d < 3)
      return numeric(
        "math",
        `Реши уравнение: x + ${extra} = ${x + extra}.`,
        x,
        `Чтобы найти неизвестное слагаемое, вычитаем: ${x + extra} − ${extra} = ${x}.`,
        d,
      );
    const addend = divisor * quotient - x;
    if (addend <= 0)
      return numeric(
        "math",
        `Реши уравнение: (x − ${extra}) × ${divisor} = ${x * divisor}.`,
        x + extra,
        `Сначала ${x * divisor} : ${divisor} = ${x}. Значит, x = ${x} + ${extra} = ${x + extra}.`,
        3,
      );
    return numeric(
      "math",
      `Реши уравнение: (x + ${addend}) : ${divisor} = ${quotient}.`,
      x,
      `Выполняем обратные действия: ${quotient} × ${divisor} − ${addend} = ${x}.`,
      3,
    );
  },
  (r, d) => {
    const rows = integer(r, 3, 9),
      trees = integer(r, 7, 18),
      otherRows = integer(r, 2, 6),
      otherTrees = integer(r, 5, 13);
    return numeric(
      "math",
      `В саду ${rows} ${pluralRu(rows, "ряд", "ряда", "рядов")} яблонь по ${trees} ${pluralRu(trees, "дереву", "дерева", "деревьев")} и ${otherRows} ${pluralRu(otherRows, "ряд", "ряда", "рядов")} груш по ${otherTrees} ${pluralRu(otherTrees, "дереву", "дерева", "деревьев")}. Сколько всего деревьев?`,
      rows * trees + otherRows * otherTrees,
      `Яблонь ${rows} × ${trees} = ${rows * trees}, груш ${otherRows} × ${otherTrees} = ${otherRows * otherTrees}. Всего ${rows * trees + otherRows * otherTrees} ${pluralRu(rows * trees + otherRows * otherTrees, "дерево", "дерева", "деревьев")}.`,
      Math.max(d, 2) as Difficulty,
    );
  },
  (r, d) => {
    const amount = integer(r, 3, 8),
      price = integer(r, 15, 75),
      change = integer(r, 20, 180),
      budget = amount * price + change;
    return numeric(
      "math",
      `У тебя ${budget} ${pluralRu(budget, "рубль", "рубля", "рублей")}. Ты покупаешь ${amount} ${pluralRu(amount, "блокнот", "блокнота", "блокнотов")} по ${price} ${pluralRu(price, "рублю", "рубля", "рублей")}. Сколько рублей останется?`,
      change,
      `Покупка стоит ${amount} × ${price} = ${amount * price} руб. Остаток: ${budget} − ${amount * price} = ${change} руб.`,
      Math.max(d, 2) as Difficulty,
      "руб.",
    );
  },
  (r, d) => {
    const speed = integer(r, 3, 12) * 5,
      hours = integer(r, 2, 8);
    if (d === 3)
      return numeric(
        "math",
        `Автобус проехал ${speed * hours} км за ${hours} ч с постоянной скоростью. Сколько километров он проедет за ${hours + 2} ч с той же скоростью?`,
        speed * (hours + 2),
        `Скорость: ${speed * hours} : ${hours} = ${speed} км/ч. Новое расстояние: ${speed} × ${hours + 2} = ${speed * (hours + 2)} км.`,
        3,
        "км",
      );
    return numeric(
      "math",
      `Автобус двигался ${hours} ч со скоростью ${speed} км/ч. Какое расстояние он преодолел?`,
      speed * hours,
      `Расстояние равно скорости, умноженной на время: ${speed} × ${hours} = ${speed * hours} км.`,
      2,
      "км",
    );
  },
  (r, d) => {
    const a = integer(r, 5, 24),
      b = integer(r, 3, 16),
      mode = integer(r, 0, 2);
    if (mode === 0)
      return numeric(
        "math",
        `Длина прямоугольника ${a} см, ширина ${b} см. Найди его периметр.`,
        (a + b) * 2,
        `Периметр: (${a} + ${b}) × 2 = ${(a + b) * 2} см.`,
        Math.min(d, 2) as Difficulty,
        "см",
      );
    if (mode === 1)
      return numeric(
        "math",
        `Длина прямоугольника ${a} см, ширина ${b} см. Найди его площадь.`,
        a * b,
        `Площадь: ${a} × ${b} = ${a * b} см². Не путай площадь с периметром.`,
        Math.min(d, 2) as Difficulty,
        "см²",
      );
    return numeric(
      "math",
      `Площадь прямоугольника ${a * b} см², его длина ${a} см. Найди ширину.`,
      b,
      `Ширина равна площади, делённой на длину: ${a * b} : ${a} = ${b} см.`,
      2,
      "см",
    );
  },
  (r, d) => {
    const units = pick(r, [
      { big: "км", small: "м", factor: 1000 },
      { big: "кг", small: "г", factor: 1000 },
      { big: "м", small: "см", factor: 100 },
      { big: "ч", small: "мин", factor: 60 },
    ]);
    const whole = integer(r, 2, 15),
      part = integer(r, 1, units.factor - 1),
      result = whole * units.factor + part;
    return numeric(
      "math",
      `Вырази ${whole} ${units.big} ${part} ${units.small} в ${units.small}.`,
      result,
      `1 ${units.big} = ${units.factor} ${units.small}. Поэтому ${whole} × ${units.factor} + ${part} = ${result} ${units.small}.`,
      Math.min(d, 2) as Difficulty,
      units.small,
    );
  },
  (r, d) => {
    const start =
        integer(r, 7, 17) * 60 +
        pick(r, [0, 10, 15, 20, 25, 30, 35, 40, 45, 50]),
      duration = integer(r, 3, d === 3 ? 20 : 11) * 5;
    const end = start + duration;
    return make(
      "math",
      `Экскурсия началась в ${time(start)} и длилась ${duration} ${pluralRu(duration, "минуту", "минуты", "минут")}. Во сколько она закончилась?`,
      time(end),
      [time(end + 10), time(end - 10), time(end + 60)],
      `Переведём время в минуты от полуночи: ${start} + ${duration} = ${end}. Это ${time(end)}.`,
      Math.max(d, 2) as Difficulty,
    );
  },
  (r, d) => {
    const parts = integer(r, 3, 8),
      onePart = integer(r, 4, 18),
      total = parts * onePart,
      used = d === 3 ? integer(r, 2, parts - 1) : 1;
    return numeric(
      "math",
      `В наборе ${total} ${pluralRu(total, "наклейка", "наклейки", "наклеек")}. В альбом вклеили ${used === 1 ? `одну из ${parts} равных частей` : `${used} из ${parts} равных частей`} всех наклеек. Сколько наклеек осталось?`,
      total - used * onePart,
      `В одной части ${total} : ${parts} = ${onePart} ${pluralRu(onePart, "наклейка", "наклейки", "наклеек")}. Вклеили ${used} × ${onePart} = ${used * onePart}. Осталось ${total - used * onePart}.`,
      Math.max(d, 2) as Difficulty,
    );
  },
  (r, d) => {
    const start = integer(r, 2, 20),
      step = integer(r, 3, 13);
    if (d < 3) {
      const terms = [start, start + step, start + step * 2, start + step * 3];
      return numeric(
        "math",
        `Найди следующее число: ${terms.join(", ")}, …`,
        start + step * 4,
        `Каждый раз прибавляем ${step}. Следующее число: ${terms[3]} + ${step} = ${start + step * 4}.`,
        d,
      );
    }
    const plus = integer(r, 1, 5),
      terms = [start];
    for (let index = 0; index < 3; index += 1)
      terms.push(terms[index] * 2 + plus);
    return numeric(
      "math",
      `Найди следующее число: ${terms.join(", ")}, …`,
      terms[3] * 2 + plus,
      `Правило: умножить на 2 и прибавить ${plus}. Значит, ${terms[3]} × 2 + ${plus} = ${terms[3] * 2 + plus}.`,
      3,
    );
  },
  (r, d) => {
    const capacity = integer(r, 5, 14),
      full = integer(r, 3, 12),
      leftover = integer(r, 1, capacity - 1),
      total = capacity * full + leftover;
    return numeric(
      "math",
      `Нужно упаковать ${total} ${pluralRu(total, "мяч", "мяча", "мячей")}. В одну коробку помещается не больше ${capacity} ${pluralRu(capacity, "мяча", "мячей", "мячей")}. Какое наименьшее число коробок понадобится?`,
      full + 1,
      `В ${full} ${pluralRu(full, "коробку", "коробки", "коробок")} поместится ${capacity * full} ${pluralRu(capacity * full, "мяч", "мяча", "мячей")}. Для ${leftover} ${pluralRu(leftover, "оставшегося мяча", "оставшихся мячей", "оставшихся мячей")} нужна ещё одна коробка. Всего ${full + 1}.`,
      Math.max(d, 2) as Difficulty,
    );
  },
  (r, d) => {
    const small = integer(r, 10, 70),
      difference = integer(r, 4, 30),
      sum = small * 2 + difference;
    return numeric(
      "math",
      `На двух полках ${sum} ${pluralRu(sum, "книга", "книги", "книг")}. На верхней на ${difference} ${pluralRu(difference, "книгу", "книги", "книг")} больше, чем на нижней. Сколько книг на нижней полке?`,
      small,
      `Уберём разницу: ${sum} − ${difference} = ${small * 2}. Разделим поровну: ${small * 2} : 2 = ${small} ${pluralRu(small, "книга", "книги", "книг")}.`,
      3,
    );
  },
  (r, d) => {
    const mass = integer(r, 2, 14),
      bags = integer(r, 3, 8),
      extra = integer(r, 2, 19),
      total = mass * bags + extra;
    return numeric(
      "math",
      `${bags} ${pluralRu(bags, "одинаковый пакет", "одинаковых пакета", "одинаковых пакетов")} и гиря массой ${extra} кг вместе весят ${total} кг. Сколько весит один пакет?`,
      mass,
      `Все пакеты весят ${total} − ${extra} = ${mass * bags} кг. Один пакет: ${mass * bags} : ${bags} = ${mass} кг.`,
      Math.max(d, 2) as Difficulty,
      "кг",
    );
  },
  (r, d) => {
    const names = shuffle(r, ["красный", "синий", "зелёный", "жёлтый"]),
      place = integer(r, 1, 4);
    return make(
      "math",
      `Четыре робота финишировали без ничьих. ${names[0]} был раньше ${names[1]}, ${names[1]} — раньше ${names[2]}, а ${names[2]} — раньше ${names[3]}. Какой робот занял место № ${place}?`,
      names[place - 1],
      names.filter((name) => name !== names[place - 1]),
      `Порядок финиша: ${names.join(" → ")}. На месте № ${place} — ${names[place - 1]} робот.`,
      Math.max(d, 2) as Difficulty,
    );
  },
  (r, d) => {
    const squareSide = integer(r, 3, 18),
      count = integer(r, 2, 6);
    return numeric(
      "math",
      `Из ${count} ${pluralRu(count, "одинакового квадрата", "одинаковых квадратов", "одинаковых квадратов")} со стороной ${squareSide} см сложили прямоугольник в один ряд без промежутков. Чему равен его периметр?`,
      2 * (squareSide * count + squareSide),
      `Длина ${squareSide} × ${count} = ${squareSide * count} см, ширина ${squareSide} см. Периметр: (${squareSide * count} + ${squareSide}) × 2 = ${2 * (squareSide * count + squareSide)} см.`,
      3,
      "см",
    );
  },
  (r, d) => {
    const rate = integer(r, 4, 15),
      first = integer(r, 2, 5),
      second = integer(r, 2, 5);
    return numeric(
      "math",
      `Мастер делает ${rate} ${pluralRu(rate, "деталь", "детали", "деталей")} в час. Сколько деталей он изготовит за ${first} ${pluralRu(first, "час", "часа", "часов")} до обеда и ${second} ${pluralRu(second, "час", "часа", "часов")} после обеда с той же производительностью?`,
      rate * (first + second),
      `Всего рабочих часов: ${first} + ${second} = ${first + second}. Деталей: ${rate} × ${first + second} = ${rate * (first + second)}.`,
      Math.max(d, 2) as Difficulty,
    );
  },
];

const nounWords = [
  "ракета",
  "дружба",
  "солнце",
  "ученик",
  "берёза",
  "смелость",
  "письмо",
  "река",
  "путешествие",
  "тетрадь",
  "дерево",
  "радость",
];
const adjectiveWords = [
  "весёлый",
  "лесной",
  "синий",
  "смелый",
  "зимний",
  "широкий",
  "золотой",
  "тихий",
  "добрый",
  "круглый",
  "тёплый",
  "далёкий",
];
const verbWords = [
  "читает",
  "бежит",
  "рисует",
  "плывёт",
  "строит",
  "поёт",
  "прыгает",
  "мечтает",
  "играет",
  "смотрит",
  "летит",
  "пишет",
];
const pronouns = ["я", "ты", "он", "мы", "вы", "они"];
const russianVerbs = [
  {
    forms: ["читаю", "читаешь", "читает", "читаем", "читаете", "читают"],
    object: "книгу",
  },
  {
    forms: ["рисую", "рисуешь", "рисует", "рисуем", "рисуете", "рисуют"],
    object: "картину",
  },
  {
    forms: ["пишу", "пишешь", "пишет", "пишем", "пишете", "пишут"],
    object: "письмо",
  },
  {
    forms: ["строю", "строишь", "строит", "строим", "строите", "строят"],
    object: "дом",
  },
  {
    forms: ["вижу", "видишь", "видит", "видим", "видите", "видят"],
    object: "море",
  },
  {
    forms: ["слышу", "слышишь", "слышит", "слышим", "слышите", "слышат"],
    object: "музыку",
  },
  {
    forms: ["учу", "учишь", "учит", "учим", "учите", "учат"],
    object: "стихотворение",
  },
  {
    forms: ["решаю", "решаешь", "решает", "решаем", "решаете", "решают"],
    object: "задачу",
  },
  {
    forms: [
      "собираю",
      "собираешь",
      "собирает",
      "собираем",
      "собираете",
      "собирают",
    ],
    object: "конструктор",
  },
  {
    forms: ["готовлю", "готовишь", "готовит", "готовим", "готовите", "готовят"],
    object: "завтрак",
  },
];
const adjectiveForms = [
  ["высокий", "высокая", "высокое", "высокие"],
  ["красивый", "красивая", "красивое", "красивые"],
  ["большой", "большая", "большое", "большие"],
  ["старый", "старая", "старое", "старые"],
  ["новый", "новая", "новое", "новые"],
  ["маленький", "маленькая", "маленькое", "маленькие"],
  ["зимний", "зимняя", "зимнее", "зимние"],
  ["соседний", "соседняя", "соседнее", "соседние"],
];
const agreementNouns = [
  { noun: "дом", form: 0 },
  { noun: "сад", form: 0 },
  { noun: "замок", form: 0 },
  { noun: "башня", form: 1 },
  { noun: "деревня", form: 1 },
  { noun: "улица", form: 1 },
  { noun: "здание", form: 2 },
  { noun: "окно", form: 2 },
  { noun: "дерево", form: 2 },
  { noun: "дома", form: 3 },
  { noun: "улицы", form: 3 },
  { noun: "окна", form: 3 },
];
const cases = [
  "Именительный",
  "Родительный",
  "Дательный",
  "Винительный",
  "Творительный",
  "Предложный",
];
const caseExamples = [
  {
    sentence: "На столе лежит книга.",
    word: "книга",
    case: 0,
    question: "что?",
  },
  {
    sentence: "Около школы растёт берёза.",
    word: "берёза",
    case: 0,
    question: "что?",
  },
  {
    sentence: "В небе сияет солнце.",
    word: "солнце",
    case: 0,
    question: "что?",
  },
  {
    sentence: "У меня нет тетради.",
    word: "тетради",
    case: 1,
    question: "нет чего?",
  },
  {
    sentence: "Мы вышли из дома.",
    word: "дома",
    case: 1,
    question: "из чего?",
  },
  {
    sentence: "Ребята дошли до реки.",
    word: "реки",
    case: 1,
    question: "до чего?",
  },
  {
    sentence: "Миша подошёл к школе.",
    word: "школе",
    case: 2,
    question: "к чему?",
  },
  {
    sentence: "Лена написала письмо другу.",
    word: "другу",
    case: 2,
    question: "кому?",
  },
  {
    sentence: "Мы шли по дорожке.",
    word: "дорожке",
    case: 2,
    question: "по чему?",
  },
  { sentence: "Я читаю книгу.", word: "книгу", case: 3, question: "что?" },
  { sentence: "Дети увидели лису.", word: "лису", case: 3, question: "кого?" },
  {
    sentence: "Мы посадили берёзу.",
    word: "берёзу",
    case: 3,
    question: "что?",
  },
  {
    sentence: "Мальчик рисует карандашом.",
    word: "карандашом",
    case: 4,
    question: "чем?",
  },
  {
    sentence: "Над лесом летит самолёт.",
    word: "лесом",
    case: 4,
    question: "над чем?",
  },
  { sentence: "Я горжусь другом.", word: "другом", case: 4, question: "кем?" },
  {
    sentence: "Мы говорили о книге.",
    word: "книге",
    case: 5,
    question: "о чём?",
  },
  {
    sentence: "Белка живёт в лесу.",
    word: "лесу",
    case: 5,
    question: "в чём?",
  },
  {
    sentence: "На окне стоит цветок.",
    word: "окне",
    case: 5,
    question: "на чём?",
  },
];
const wordRelations = [
  ["смелый", "храбрый", "трусливый"],
  ["быстрый", "скорый", "медленный"],
  ["огромный", "громадный", "крошечный"],
  ["добрый", "отзывчивый", "злой"],
  ["тихий", "негромкий", "шумный"],
  ["весёлый", "радостный", "грустный"],
  ["высокий", "рослый", "низкий"],
  ["мокрый", "влажный", "сухой"],
  ["горячий", "жаркий", "холодный"],
  ["старый", "давний", "новый"],
  ["правдивый", "честный", "лживый"],
  ["трудолюбивый", "старательный", "ленивый"],
];
const rootGroups = [
  { words: "лес, лесной, лесник", root: "-лес-" },
  { words: "вода, водный, подводный", root: "-вод-" },
  { words: "сад, садик, садовый", root: "-сад-" },
  { words: "дом, домик, домашний", root: "-дом-" },
  { words: "гора, горка, горный", root: "-гор-" },
  { words: "зима, зимний, зимовать", root: "-зим-" },
  { words: "снег, снежный, подснежник", root: "-снег- / -снеж-" },
  { words: "рыба, рыбка, рыбный", root: "-рыб-" },
];
const russianTemplates: Template[] = [
  (r, d) => {
    const categories = [nounWords, adjectiveWords, verbWords];
    const names = ["имя существительное", "имя прилагательное", "глагол"];
    const category = integer(r, 0, 2),
      correct = pick(r, categories[category]);
    const otherCategories = categories.filter((_, index) => index !== category);
    const alternatives = [...otherCategories[0], ...otherCategories[1]].slice();
    return make(
      "russian",
      `Найди ${names[category]}.`,
      correct,
      shuffle(r, alternatives).slice(0, 3),
      `«${correct}» — ${names[category]}. ${category === 0 ? "Оно обозначает предмет или понятие и отвечает на вопрос «кто?» или «что?»." : category === 1 ? "Оно обозначает признак предмета и отвечает на вопрос «какой?»." : "Он обозначает действие и отвечает на вопрос «что делает?»."}`,
      Math.min(d, 2) as Difficulty,
    );
  },
  (r, d) => {
    const example = pick(r, caseExamples),
      correct = cases[example.case];
    return make(
      "russian",
      `Определи падеж слова «${example.word}»: «${example.sentence}»`,
      correct,
      cases.filter((value) => value !== correct).slice(0, 3),
      `Задаём вопрос: ${example.question} ${example.word}. Это ${correct.toLowerCase()} падеж.`,
      Math.max(d, 2) as Difficulty,
    );
  },
  (r, d) => {
    const noun = pick(r, agreementNouns),
      forms = pick(r, adjectiveForms);
    return make(
      "russian",
      `Выбери прилагательное для сочетания «… ${noun.noun}».`,
      forms[noun.form],
      forms.filter((_, index) => index !== noun.form),
      `Правильно: «${forms[noun.form]} ${noun.noun}». Прилагательное согласуется с существительным в роде и числе.`,
      Math.min(d, 2) as Difficulty,
    );
  },
  (r, d) => {
    const verb = pick(r, russianVerbs),
      person = integer(r, 0, pronouns.length - 1),
      correct = verb.forms[person];
    return make(
      "russian",
      `Выбери верную форму: «${pronouns[person]} … ${verb.object}».`,
      correct,
      verb.forms.filter((value) => value !== correct).slice(0, 3),
      `Согласуем глагол с местоимением: «${pronouns[person]} ${correct} ${verb.object}». Форма показывает лицо и число.`,
      Math.max(d, 2) as Difficulty,
    );
  },
  (r, d) => {
    const words = pick(r, wordRelations),
      antonym = r() < 0.5,
      correct = words[antonym ? 2 : 1];
    const wrong = antonym
      ? [words[1], "деревянный", "вчерашний"]
      : [words[2], "деревянный", "вчерашний"];
    return make(
      "russian",
      `Найди ${antonym ? "антоним" : "синоним"} слова «${words[0]}».`,
      correct,
      wrong,
      `«${words[0]}» и «${correct}» ${antonym ? "противоположны" : "близки"} по значению. Такие слова называют ${antonym ? "антонимами" : "синонимами"}.`,
      Math.min(d, 2) as Difficulty,
    );
  },
  (r, d) => {
    const pairs = [
      ["леса́", "лес", "лесно́й", "лесни́к", "лесови́к"],
      ["вода́", "во́ды", "води́ца", "водяно́й", "водово́з"],
      ["гора́", "го́ры", "гора́ми", "гора́х", "гора́м"],
      ["зима́", "зи́мы", "зимо́й", "зимово́й", "зимова́ть"],
      ["сады́", "сад", "садо́вый", "садово́д", "садовни́к"],
      ["поля́", "по́ле", "полева́я", "полево́й", "полево́д"],
      ["моря́", "мо́ре", "морско́й", "моря́к", "морячо́к"],
      ["дома́", "дом", "домо́вый", "домово́й", "домови́тый"],
    ];
    const words = pick(r, pairs);
    return make(
      "russian",
      `Какое слово проверяет безударную гласную корня в слове «${words[0]}»?`,
      words[1],
      words.slice(2),
      `Проверочное слово — «${words[1]}»: нужная гласная стоит под ударением, и её хорошо слышно.`,
      Math.max(d, 2) as Difficulty,
    );
  },
  (r, d) => {
    const example = pick(r, rootGroups),
      wrongRoots = rootGroups
        .filter((group) => group.root !== example.root)
        .map((group) => group.root);
    return make(
      "russian",
      `Найди общую корневую часть слов: ${example.words}.`,
      example.root,
      wrongRoots.slice(0, 3),
      `Эти слова родственны по значению. Их общий корень: ${example.root}${example.root.includes("/") ? " (с чередованием согласных)" : ""}.`,
      Math.max(d, 2) as Difficulty,
    );
  },
  (r, d) => {
    const subjects = [
      { who: "Соловей", action: "пел", place: "В саду" },
      { who: "Самолёт", action: "летел", place: "Над лесом" },
      { who: "Мальчик", action: "играл", place: "Во дворе" },
      { who: "Ручей", action: "журчал", place: "В лесу" },
      { who: "Ветер", action: "шумел", place: "За окном" },
      { who: "Дождь", action: "шёл", place: "С утра" },
    ];
    const example = pick(r, subjects);
    return make(
      "russian",
      `Найди грамматическую основу: «${example.place} ${example.action} ${example.who.toLowerCase()}».`,
      `${example.who} ${example.action}`,
      [
        `${example.place} ${example.action}`,
        `${example.place} ${example.who.toLowerCase()}`,
        example.action,
      ],
      `Подлежащее — «${example.who.toLowerCase()}», сказуемое — «${example.action}». Вместе они составляют грамматическую основу.`,
      Math.max(d, 2) as Difficulty,
    );
  },
];

const englishPronouns = ["I", "you", "he", "she", "it", "we", "they"];
const presentVerbs = [
  { base: "play", third: "plays", ing: "playing", object: "football" },
  { base: "read", third: "reads", ing: "reading", object: "books" },
  { base: "watch", third: "watches", ing: "watching", object: "TV" },
  { base: "draw", third: "draws", ing: "drawing", object: "pictures" },
  { base: "eat", third: "eats", ing: "eating", object: "apples" },
  { base: "make", third: "makes", ing: "making", object: "toys" },
  { base: "write", third: "writes", ing: "writing", object: "letters" },
  { base: "sing", third: "sings", ing: "singing", object: "songs" },
];
const englishNames = [
  "Tom",
  "Kate",
  "Ben",
  "Alice",
  "Jack",
  "Lucy",
  "Sam",
  "Anna",
];
const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const smallNumbers = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const tens = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];
const numberWord = (number: number) =>
  number === 100
    ? "one hundred"
    : number < 20
      ? smallNumbers[number]
      : `${tens[Math.floor(number / 10)]}${number % 10 ? `-${smallNumbers[number % 10]}` : ""}`;
const englishTemplates: Template[] = [
  (r, d) => {
    const person = integer(r, 0, 6),
      adjective = pick(r, [
        "happy",
        "tired",
        "hungry",
        "ready",
        "kind",
        "friendly",
      ]),
      correct = person === 0 ? "am" : person >= 2 && person <= 4 ? "is" : "are";
    return make(
      "english",
      `Вставь форму be в настоящем времени: «${englishPronouns[person]} … ${adjective}».`,
      correct,
      ["am", "is", "are", "be"].filter((word) => word !== correct),
      `Правильно: «${englishPronouns[person]} ${correct} ${adjective}». С I — am, с he/she/it — is, с you/we/they — are.`,
      Math.min(d, 2) as Difficulty,
    );
  },
  (r, d) => {
    const person = integer(r, 0, 6),
      item = pick(r, [
        "a book",
        "a kite",
        "a bike",
        "a dog",
        "a toy",
        "a ball",
      ]),
      correct = person >= 2 && person <= 4 ? "has" : "have";
    return make(
      "english",
      `Выбери слово: «${englishPronouns[person]} … got ${item}».`,
      correct,
      ["have", "has", "am", "is"].filter((word) => word !== correct),
      `Правильно: «${englishPronouns[person]} ${correct} got ${item}». С he/she/it употребляется has got, с остальными личными местоимениями — have got.`,
      Math.min(d, 2) as Difficulty,
    );
  },
  (r, d) => {
    const person = integer(r, 0, 6),
      verb = pick(r, presentVerbs),
      correct = person >= 2 && person <= 4 ? verb.third : verb.base;
    return make(
      "english",
      `Выбери форму Present Simple: «${englishPronouns[person]} … ${verb.object} every day».`,
      correct,
      [verb.base, verb.third, verb.ing, `to ${verb.base}`].filter(
        (word) => word !== correct,
      ),
      `Правильно: «${englishPronouns[person]} ${correct} ${verb.object} every day». С he/she/it у глагола окончание -s или -es.`,
      Math.max(d, 2) as Difficulty,
    );
  },
  (r, d) => {
    const person = integer(r, 0, 6),
      verb = pick(r, presentVerbs),
      be = person === 0 ? "am" : person >= 2 && person <= 4 ? "is" : "are",
      correct = `${be} ${verb.ing}`;
    return make(
      "english",
      `Действие происходит сейчас: «${englishPronouns[person]} … ${verb.object} now».`,
      correct,
      [`am ${verb.ing}`, `is ${verb.ing}`, `are ${verb.ing}`, verb.base].filter(
        (word) => word !== correct,
      ),
      `Present Continuous: форма am/is/are + глагол с -ing. Правильно: «${englishPronouns[person]} ${correct} ${verb.object} now».`,
      Math.max(d, 2) as Difficulty,
    );
  },
  (r, d) => {
    const places = [
        { ru: "под", en: "under" },
        { ru: "на", en: "on" },
        { ru: "за", en: "behind" },
        { ru: "рядом со", en: "next to" },
      ],
      place = pick(r, places);
    const objects = [
        { ru: "стулом", en: "the chair" },
        { ru: "столом", en: "the table" },
        { ru: "шкафом", en: "the cupboard" },
      ],
      object = pick(r, objects);
    const locative: Record<string, string> = {
      стулом: "стуле",
      столом: "столе",
      шкафом: "шкафу",
    };
    const russianObject = place.en === "on" ? locative[object.ru] : object.ru;
    const russianPlace = place.ru;
    return make(
      "english",
      `Кошка находится ${russianPlace} ${russianObject}. Заполни: «The cat is … ${object.en}».`,
      place.en,
      places.filter((item) => item.en !== place.en).map((item) => item.en),
      `«${place.en}» означает «${russianPlace}». Полное предложение: The cat is ${place.en} ${object.en}.`,
      Math.min(d, 2) as Difficulty,
    );
  },
  (r, d) => {
    const number = integer(r, d === 1 ? 1 : 20, d === 1 ? 20 : 99);
    return make(
      "english",
      `Как по-английски записать число ${number}?`,
      numberWord(number),
      [number + 1, number - 1, (number + 10) % 100].map(numberWord),
      `Число ${number} по-английски — ${numberWord(number)}. В составных числах от 21 до 99 десятки и единицы соединяются дефисом.`,
      Math.min(d, 2) as Difficulty,
    );
  },
  (r, d) => {
    const words = [
        ["child", "children", "childs", "childes", "childrens"],
        ["mouse", "mice", "mouses", "mices", "mouse"],
        ["man", "men", "mans", "manes", "mens"],
        ["woman", "women", "womans", "womens", "womanes"],
        ["foot", "feet", "foots", "feets", "footes"],
        ["tooth", "teeth", "tooths", "teeths", "toothes"],
        ["book", "books", "bookes", "bookies", "book"],
        ["box", "boxes", "boxs", "boxies", "box"],
        ["baby", "babies", "babys", "babyes", "baby"],
        ["city", "cities", "citys", "cityes", "city"],
      ],
      word = pick(r, words);
    return make(
      "english",
      `Выбери множественное число слова «${word[0]}».`,
      word[1],
      word.slice(2),
      `Один предмет — ${word[0]}, несколько — ${word[1]}. Эту форму множественного числа полезно запомнить.`,
      Math.max(d, 2) as Difficulty,
    );
  },
  (r, d) => {
    const name = pick(r, englishNames),
      day = pick(r, weekdays),
      verb = pick(r, presentVerbs);
    return make(
      "english",
      `Прочитай: «${name} ${verb.third} ${verb.object} on ${day}». В какой день это происходит?`,
      day,
      weekdays.filter((value) => value !== day).slice(0, 3),
      `Слова on ${day} означают «в ${["понедельник", "вторник", "среду", "четверг", "пятницу", "субботу", "воскресенье"][weekdays.indexOf(day)]}».`,
      Math.max(d, 2) as Difficulty,
    );
  },
  (r, d) => {
    const words = [
        ["big", "bigger", "biggest", "biger", "bigly"],
        ["small", "smaller", "smallest", "smalling", "small"],
        ["tall", "taller", "tallest", "talling", "tall"],
        ["short", "shorter", "shortest", "shorting", "short"],
        ["old", "older", "oldest", "olding", "old"],
        ["young", "younger", "youngest", "younging", "young"],
        ["happy", "happier", "happiest", "happyer", "happys"],
        ["fast", "faster", "fastest", "fasting", "fast"],
      ],
      word = pick(r, words);
    return make(
      "english",
      `Выбери сравнительную степень прилагательного «${word[0]}» для сравнения двух предметов.`,
      word[1],
      word.slice(2),
      `Сравнительная степень: ${word[0]} → ${word[1]}. Обычно к короткому прилагательному добавляется -er, иногда изменяется написание основы.`,
      Math.max(d, 2) as Difficulty,
    );
  },
  (r, d) => {
    const words = [
        "apple",
        "orange",
        "umbrella",
        "elephant",
        "egg",
        "ant",
        "book",
        "cat",
        "dog",
        "kite",
        "tiger",
        "banana",
      ],
      word = pick(r, words),
      correct = /^[aeiou]/.test(word) ? "an" : "a";
    return make(
      "english",
      `Выбери артикль: «This is … ${word}».`,
      correct,
      ["a", "an", "two", "are"].filter((value) => value !== correct),
      `Правильно: ${correct} ${word}. Перед гласным звуком ставится an, перед согласным — a.`,
      Math.min(d, 2) as Difficulty,
    );
  },
];

const historicalEvents = [
  { event: "Крещение Руси", year: 988 },
  { event: "первое летописное упоминание Москвы", year: 1147 },
  { event: "Ледовое побоище", year: 1242 },
  { event: "Куликовская битва", year: 1380 },
  {
    event: "издание Иваном Фёдоровым и Петром Мстиславцем «Апостола» в Москве",
    year: 1564,
  },
  { event: "основание Санкт-Петербурга", year: 1703 },
  { event: "основание Московского университета", year: 1755 },
  { event: "Отечественная война против армии Наполеона", year: 1812 },
  { event: "первый полёт человека в космос", year: 1961 },
];
const directions = ["север", "восток", "юг", "запад"];
const foodChains = [
  ["трава", "заяц", "лиса"],
  ["трава", "кузнечик", "лягушка"],
  ["зерно", "мышь", "сова"],
  ["листья дуба", "гусеница", "синица"],
  ["водоросли", "головастик", "цапля"],
  ["трава", "гусеница", "скворец"],
  ["зерно", "воробей", "ястреб"],
  ["трава", "полёвка", "сова"],
];
const planetNames = [
  "Меркурий",
  "Венера",
  "Земля",
  "Марс",
  "Юпитер",
  "Сатурн",
  "Уран",
  "Нептун",
];
const worldTemplates: Template[] = [
  (r, d) => {
    const scale = pick(r, [2, 5, 10, 20, 25, 50, 100]),
      length = integer(r, 2, 15);
    return numeric(
      "world",
      `Масштаб карты: в 1 см — ${scale} км. Расстояние между городами на карте ${length} см. Сколько это километров на местности?`,
      scale * length,
      `Каждый сантиметр соответствует ${scale} км. ${length} × ${scale} = ${scale * length} км.`,
      Math.max(d, 2) as Difficulty,
      "км",
    );
  },
  (r, d) => {
    const event = pick(r, historicalEvents),
      century = Math.ceil(event.year / 100);
    return numeric(
      "world",
      `Известно, что ${event.event} — ${event.year} год. Какой это век? Укажи номер века.`,
      century,
      `${century}-й век включает годы с ${(century - 1) * 100 + 1} по ${century * 100}. Поэтому ${event.year} год относится к ${century}-му веку.`,
      Math.max(d, 2) as Difficulty,
    );
  },
  (r, d) => {
    const events = shuffle(r, historicalEvents)
      .slice(0, 2)
      .sort((a, b) => a.year - b.year);
    return numeric(
      "world",
      `Даты из истории: ${events[0].event} — ${events[0].year} г.; ${events[1].event} — ${events[1].year} г. На сколько лет второе событие произошло позже первого?`,
      events[1].year - events[0].year,
      `Находим разность лет: ${events[1].year} − ${events[0].year} = ${events[1].year - events[0].year}. Обе даты даны в условии.`,
      Math.max(d, 2) as Difficulty,
    );
  },
  (r, d) => {
    const chain = pick(r, foodChains),
      missing = integer(r, 0, 2),
      correct = chain[missing];
    const rendered = chain
      .map((value, index) => (index === missing ? "…" : value))
      .join(" → ");
    const wrong =
      missing === 0
        ? ["камень", "песок", "воздух"]
        : missing === 1
          ? ["камень", "воздух", "песок"]
          : ["камень", "песок", "ветер"];
    return make(
      "world",
      `Восстанови цепь питания: ${rendered}. Стрелка идёт от пищи к тому, кто её ест.`,
      correct,
      wrong,
      `Цепь: ${chain.join(" → ")}. Каждое следующее живое существо может питаться предыдущим звеном.`,
      Math.min(d, 2) as Difficulty,
    );
  },
  (r, d) => {
    const start = integer(r, 0, 3),
      turn = pick(r, [-1, 1, 2]),
      target = (start + turn + 4) % 4;
    return make(
      "world",
      `Ты смотришь на ${directions[start]}. Куда ты будешь смотреть, если ${turn === 2 ? "повернёшься кругом" : turn === 1 ? "повернёшь направо на четверть оборота" : "повернёшь налево на четверть оборота"}?`,
      directions[target],
      directions.filter((_, index) => index !== target),
      `На компасе по часовой стрелке: север → восток → юг → запад. После поворота направление — ${directions[target]}.`,
      Math.max(d, 2) as Difficulty,
    );
  },
  (r, d) => {
    const position = integer(r, 1, 8),
      correct = planetNames[position - 1];
    return make(
      "world",
      `Какая планета находится на месте № ${position}, если считать от Солнца?`,
      correct,
      planetNames.filter((value) => value !== correct).slice(0, 3),
      `Порядок планет от Солнца: ${planetNames.join(", ")}. На месте № ${position} — ${correct}.`,
      Math.min(d, 2) as Difficulty,
    );
  },
  (r, d) => {
    const morning = integer(r, 0, 18),
      rise = integer(r, 3, 14),
      evening = morning + rise;
    return numeric(
      "world",
      `Утром термометр показывал +${morning} °C, а днём +${evening} °C. На сколько градусов повысилась температура?`,
      rise,
      `Чтобы узнать повышение температуры, найдём разность: ${evening} − ${morning} = ${rise} °C.`,
      Math.min(d, 2) as Difficulty,
      "°C",
    );
  },
];

export const proceduralFamilyCounts = {
  math: mathTemplates.length,
  russian: russianTemplates.length,
  english: englishTemplates.length,
  world: worldTemplates.length,
  literature: 0,
};

function difficultyForLevel(random: Random, level: number): Difficulty {
  const roll = random();
  if (level >= 5) return roll < 0.4 ? 2 : 3;
  if (level >= 3) return roll < 0.15 ? 1 : roll < 0.65 ? 2 : 3;
  return roll < 0.35 ? 1 : 2;
}

/** Reproducible hybrid rounds: curated DB content plus original procedural tasks.
 * Literature deliberately stays a finite, reviewed bank; the app must not describe
 * this as infinite literary content. First mixed cycle has four procedural tasks.
 */
export function generateQuestions(
  subject: SubjectId | "mixed",
  count: number,
  seed: number,
  level = 1,
  bank: Question[] = questions,
): Question[] {
  const random = rng(seed);
  const requested = Number.isFinite(count)
    ? Math.max(0, Math.min(500, Math.floor(count)))
    : 8;
  const templates: Partial<Record<SubjectId, Template[]>> = {
    math: mathTemplates,
    russian: russianTemplates,
    english: englishTemplates,
    world: worldTemplates,
  };
  const pools = Object.fromEntries(
    subjectIds.map((id) => [
      id,
      shuffle(
        random,
        bank.filter(
          (question) =>
            question.subject === id && (level >= 2 || question.difficulty <= 2),
        ),
      ),
    ]),
  ) as Record<SubjectId, Question[]>;
  const cursors: Record<SubjectId, number> = {
    math: 0,
    world: 0,
    russian: 0,
    english: 0,
    literature: 0,
  };
  const result: Question[] = [],
    seen = new Set<string>();
  let attempts = 0;
  while (result.length < requested && attempts < requested * 50 + 50) {
    const cycle = subject === "mixed" ? shuffle(random, subjectIds) : [subject];
    let possible = false;
    for (const id of cycle) {
      if (result.length >= requested) break;
      const availableTemplates = templates[id];
      const pool = pools[id];
      if (!availableTemplates && cursors[id] >= pool.length) continue;
      possible = true;
      attempts += 1;
      let question: Question;
      const firstMixedCycle = subject === "mixed" && result.length < 5;
      if (
        availableTemplates &&
        (firstMixedCycle || cursors[id] >= pool.length || random() < 0.8)
      ) {
        question = pick(random, availableTemplates)(
          random,
          difficultyForLevel(random, level),
        );
      } else {
        question = {
          ...pool[cursors[id]++],
          choices: [...pool[cursors[id] - 1].choices],
        };
        question.id = questionContentId(question);
      }
      if (seen.has(question.id)) continue;
      seen.add(question.id);
      const choices = shuffle(
        random,
        question.choices.map((label, index) => ({
          label,
          correct: index === question.answer,
        })),
      );
      result.push({
        ...question,
        choices: choices.map((choice) => choice.label),
        answer: choices.findIndex((choice) => choice.correct),
      });
    }
    if (!possible) break;
  }
  return result;
}
