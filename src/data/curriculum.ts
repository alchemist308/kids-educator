import type { SubjectId } from "./questions.ts";

export const YEAR_WEEKS = 52;
export const QUESTS_PER_WEEK = 5;
export const QUESTIONS_PER_QUEST = 8;
export const YEAR_TOTAL_QUESTS = YEAR_WEEKS * QUESTS_PER_WEEK;
export const YEAR_TOTAL_QUESTIONS = YEAR_TOTAL_QUESTS * QUESTIONS_PER_QUEST;

export type YearPhase = "discover" | "practice" | "connect" | "master";
export type TopicId =
  | "math-order"
  | "math-equations"
  | "math-multistep"
  | "math-money"
  | "math-motion"
  | "math-geometry"
  | "math-units"
  | "math-time"
  | "math-fractions"
  | "math-patterns"
  | "math-remainders"
  | "math-sum-difference"
  | "math-mass"
  | "math-logic"
  | "math-composite-geometry"
  | "math-productivity"
  | "world-map"
  | "world-centuries"
  | "world-timeline"
  | "world-food-chains"
  | "world-directions"
  | "world-space"
  | "world-weather"
  | "russian-parts"
  | "russian-cases"
  | "russian-agreement"
  | "russian-verb-forms"
  | "russian-word-relations"
  | "russian-checking-words"
  | "russian-roots"
  | "russian-sentence"
  | "english-be"
  | "english-have"
  | "english-present-simple"
  | "english-present-continuous"
  | "english-prepositions"
  | "english-numbers"
  | "english-plurals"
  | "english-weekdays"
  | "english-comparatives"
  | "english-articles"
  | "literature-reading"
  | "literature-genres"
  | "literature-characters"
  | "literature-theme"
  | "literature-sequence"
  | "literature-poetry"
  | "literature-authors"
  | "literature-figurative";

export interface TopicDefinition {
  subject: SubjectId;
  title: string;
  /** Ordered from recognition through explanation to independent application. */
  skills: readonly [string, string, string];
  /** Indices in the repository's reviewed procedural template arrays. */
  templateIndices: readonly number[];
}
const define = (
  subject: SubjectId,
  title: string,
  templateIndex: number | null,
  first: string,
  second: string,
  third: string,
): TopicDefinition => ({
  subject,
  title,
  templateIndices: templateIndex === null ? [] : [templateIndex],
  skills: [first, second, third],
});

/** These are additional-practice topics, not a claim of complete textbook coverage.
 * Every procedural topic points to real existing tasks; reading uses reviewed texts.
 */
export const topicCatalog: Readonly<Record<TopicId, TopicDefinition>> = {
  "math-order": define(
    "math",
    "Порядок действий",
    0,
    "Сначала выполнять умножение, затем сложение",
    "Объяснять роль скобок в выражении",
    "Проверять значение выражения по шагам",
  ),
  "math-equations": define(
    "math",
    "Уравнения и обратные действия",
    1,
    "Находить неизвестное слагаемое",
    "Решать уравнение двумя обратными действиями",
    "Подставлять найденное число для проверки",
  ),
  "math-multistep": define(
    "math",
    "Задачи в несколько действий",
    2,
    "Выделять данные и вопрос задачи",
    "Составлять план из нескольких действий",
    "Проверять, учтены ли обе группы предметов",
  ),
  "math-money": define(
    "math",
    "Покупки и сдача",
    3,
    "Находить стоимость нескольких одинаковых покупок",
    "Вычислять остаток денег после покупки",
    "Объяснять порядок расчёта бюджета",
  ),
  "math-motion": define(
    "math",
    "Скорость, время, расстояние",
    4,
    "Находить расстояние по скорости и времени",
    "Находить скорость по расстоянию и времени",
    "Переносить найденную скорость в новое условие",
  ),
  "math-geometry": define(
    "math",
    "Площадь и периметр",
    5,
    "Различать площадь и периметр прямоугольника",
    "Находить неизвестную сторону по площади",
    "Выбирать правильную единицу измерения",
  ),
  "math-units": define(
    "math",
    "Измеряем и переводим величины",
    6,
    "Вспоминать соотношения единиц",
    "Переводить составную величину в меньшие единицы",
    "Проверять масштаб полученного числа",
  ),
  "math-time": define(
    "math",
    "Время и длительность",
    7,
    "Читать время по часам",
    "Вычислять время окончания события",
    "Проверять переход через границу часа",
  ),
  "math-fractions": define(
    "math",
    "Доли и целое",
    8,
    "Находить одну равную часть количества",
    "Находить несколько равных частей",
    "Вычислять оставшуюся часть целого",
  ),
  "math-patterns": define(
    "math",
    "Закономерности числовых рядов",
    9,
    "Находить одинаковый шаг ряда",
    "Объяснять правило умножения и прибавления",
    "Проверять правило на всех известных числах",
  ),
  "math-remainders": define(
    "math",
    "Деление с остатком в жизни",
    10,
    "Выделять полные группы предметов",
    "Учитывать остаток при выборе числа коробок",
    "Объяснять, почему иногда нужна ещё одна группа",
  ),
  "math-sum-difference": define(
    "math",
    "Задачи на сумму и разность",
    11,
    "Отделять общую сумму от разницы",
    "Находить меньшую величину в два действия",
    "Проверять обе величины по исходному условию",
  ),
  "math-mass": define(
    "math",
    "Взвешивание и равные части",
    12,
    "Отделять известную массу от общей",
    "Находить массу одного одинакового пакета",
    "Проверять ответ обратным вычислением",
  ),
  "math-logic": define(
    "math",
    "Логический порядок",
    13,
    "Читать условия «раньше» и «позже»",
    "Восстанавливать порядок четырёх участников",
    "Находить нужное место без перебора наугад",
  ),
  "math-composite-geometry": define(
    "math",
    "Фигуры из квадратов",
    14,
    "Представлять прямоугольник из одинаковых квадратов",
    "Вычислять длину составленной фигуры",
    "Находить её внешний периметр",
  ),
  "math-productivity": define(
    "math",
    "План работы и производительность",
    15,
    "Находить общее время работы",
    "Находить результат по работе за один час",
    "Проверять решение разными группировками действий",
  ),
  "world-map": define(
    "world",
    "Расстояния на карте",
    0,
    "Читать условие масштаба",
    "Переводить расстояние на карте в километры",
    "Сопоставлять карту и настоящую местность",
  ),
  "world-centuries": define(
    "world",
    "Годы и века истории",
    1,
    "Связывать год с номером века",
    "Определять границы века",
    "Объяснять переход от года к следующему веку",
  ),
  "world-timeline": define(
    "world",
    "Лента времени России",
    2,
    "Сравнивать даты известных событий",
    "Находить промежуток между событиями",
    "Читать исторические данные, не угадывая даты",
  ),
  "world-food-chains": define(
    "world",
    "Связи в живой природе",
    3,
    "Различать пищу и того, кто ею питается",
    "Восстанавливать звено цепи питания",
    "Объяснять направление стрелок в цепи",
  ),
  "world-directions": define(
    "world",
    "Компас и стороны горизонта",
    4,
    "Называть четыре стороны горизонта",
    "Находить направление после поворота",
    "Проверять мысленный маршрут по компасу",
  ),
  "world-space": define(
    "world",
    "Планеты Солнечной системы",
    5,
    "Вспоминать названия восьми планет",
    "Определять место планеты от Солнца",
    "Восстанавливать порядок планет",
  ),
  "world-weather": define(
    "world",
    "Наблюдения за температурой",
    6,
    "Читать показания термометра",
    "Находить изменение температуры",
    "Различать показание прибора и его изменение",
  ),
  "russian-parts": define(
    "russian",
    "Части речи",
    0,
    "Узнавать существительное, прилагательное и глагол",
    "Подбирать к слову вопрос",
    "Объяснять выбор части речи по значению",
  ),
  "russian-cases": define(
    "russian",
    "Падежи в предложении",
    1,
    "Ставить вопрос к существительному",
    "Определять падеж по связи слов",
    "Отличать похожие формы в разных предложениях",
  ),
  "russian-agreement": define(
    "russian",
    "Согласование прилагательных",
    2,
    "Определять род и число существительного",
    "Выбирать подходящую форму прилагательного",
    "Проверять согласование в словосочетании",
  ),
  "russian-verb-forms": define(
    "russian",
    "Лицо и число глагола",
    3,
    "Связывать глагол с личным местоимением",
    "Выбирать форму глагола по лицу и числу",
    "Объяснять изменение окончания",
  ),
  "russian-word-relations": define(
    "russian",
    "Синонимы и антонимы",
    4,
    "Отличать близкое значение от противоположного",
    "Находить точный синоним или антоним",
    "Проверять значение слова в паре",
  ),
  "russian-checking-words": define(
    "russian",
    "Проверочные слова",
    5,
    "Находить безударную гласную в корне",
    "Выбирать форму с ударной проверяемой гласной",
    "Объяснять, почему родственное слово не всегда проверочное",
  ),
  "russian-roots": define(
    "russian",
    "Корень и родственные слова",
    6,
    "Находить общую значимую часть слов",
    "Связывать родственные слова по смыслу",
    "Замечать чередование согласных в корне",
  ),
  "russian-sentence": define(
    "russian",
    "Грамматическая основа",
    7,
    "Находить подлежащее и сказуемое",
    "Отделять основу от второстепенных членов",
    "Проверять основу в предложении с необычным порядком слов",
  ),
  "english-be": define(
    "english",
    "I am, you are, he is",
    0,
    "Узнавать личные местоимения",
    "Выбирать am, is или are",
    "Проверять законченное английское предложение",
  ),
  "english-have": define(
    "english",
    "Have got и has got",
    1,
    "Рассказывать, что у кого есть",
    "Выбирать have got или has got",
    "Согласовывать выражение с местоимением",
  ),
  "english-present-simple": define(
    "english",
    "Что происходит обычно",
    2,
    "Узнавать регулярное действие по every day",
    "Выбирать форму глагола с he, she, it",
    "Объяснять окончание -s или -es",
  ),
  "english-present-continuous": define(
    "english",
    "Что происходит сейчас",
    3,
    "Узнавать действие по слову now",
    "Соединять am, is, are с формой -ing",
    "Отличать действие сейчас от обычного действия",
  ),
  "english-prepositions": define(
    "english",
    "Где находится предмет",
    4,
    "Узнавать on, under, behind и next to",
    "Выбирать предлог места по описанию",
    "Собирать полное описание положения предмета",
  ),
  "english-numbers": define(
    "english",
    "Числа по-английски",
    5,
    "Читать числа от 1 до 20",
    "Различать десятки и единицы до 99",
    "Проверять запись составного числительного",
  ),
  "english-plurals": define(
    "english",
    "Один и несколько",
    6,
    "Различать единственное и множественное число",
    "Вспоминать особые формы children, mice, feet",
    "Выбирать форму по знакомому образцу",
  ),
  "english-weekdays": define(
    "english",
    "Дни недели в небольшом тексте",
    7,
    "Узнавать английские названия дней",
    "Находить день события в предложении",
    "Читать сочетание on с днём недели",
  ),
  "english-comparatives": define(
    "english",
    "Сравниваем два предмета",
    8,
    "Понимать смысл сравнительной степени",
    "Выбирать правильную форму с -er",
    "Отличать сравнение двух предметов от превосходной степени",
  ),
  "english-articles": define(
    "english",
    "A или an",
    9,
    "Замечать начальный звук слова",
    "Выбирать a или an перед знакомым словом",
    "Проверять выбор по произношению, а не только по букве",
  ),
  "literature-reading": define(
    "literature",
    "Внимательное чтение",
    null,
    "Находить ответ прямо в тексте",
    "Подтверждать ответ словами произведения",
    "Отделять факт текста от собственной догадки",
  ),
  "literature-genres": define(
    "literature",
    "Чтение и литературные жанры",
    null,
    "Различать рассказ, сказку и стихотворение",
    "Замечать признаки жанра",
    "Объяснять, как форма помогает понять произведение",
  ),
  "literature-characters": define(
    "literature",
    "Чтение и поступки героев",
    null,
    "Находить главного героя",
    "Связывать поступок с причиной",
    "Подтверждать характеристику героя эпизодом",
  ),
  "literature-theme": define(
    "literature",
    "Чтение и смысл текста",
    null,
    "Определять, о чём говорится в тексте",
    "Отличать главную мысль от отдельной детали",
    "Выбирать вывод, который подтверждён произведением",
  ),
  "literature-sequence": define(
    "literature",
    "Чтение и порядок событий",
    null,
    "Находить начало, середину и конец истории",
    "Восстанавливать последовательность событий",
    "Объяснять связь причины и следствия",
  ),
  "literature-poetry": define(
    "literature",
    "Чтение и понятия о стихах",
    null,
    "Находить ответ в новом тексте",
    "Повторять определение рифмы на знакомом примере",
    "Различать чтение рассказа и стихотворную речь",
  ),
  "literature-authors": define(
    "literature",
    "Чтение и знакомые авторы",
    null,
    "Соотносить знакомого автора и произведение",
    "Различать авторский текст и народное творчество",
    "Связывать новое чтение с известным произведением",
  ),
  "literature-figurative": define(
    "literature",
    "Чтение и художественные приёмы",
    null,
    "Замечать сравнение в знакомом примере",
    "Различать прямое и переносное значение",
    "Подтверждать ответ словами нового текста",
  ),
};

export interface WeekSubjectPlan {
  title: string;
  topic: TopicId;
  skills: string[];
}
export interface WeekPlan {
  week: number;
  title: string;
  phase: YearPhase;
  subjects: Record<SubjectId, WeekSubjectPlan>;
  review: boolean;
  checkpoint: boolean;
}
type WeekRow = readonly [string, TopicId, TopicId, TopicId, TopicId, TopicId];
const rows: readonly WeekRow[] = [
  [
    "Первые шаги исследователя",
    "math-patterns",
    "world-directions",
    "russian-parts",
    "english-be",
    "literature-genres",
  ],
  [
    "Наводим порядок",
    "math-order",
    "world-map",
    "russian-roots",
    "english-articles",
    "literature-sequence",
  ],
  [
    "Наблюдаем и сравниваем",
    "math-units",
    "world-weather",
    "russian-agreement",
    "english-numbers",
    "literature-characters",
  ],
  [
    "Проверяем первые открытия",
    "math-multistep",
    "world-food-chains",
    "russian-sentence",
    "english-be",
    "literature-reading",
  ],
  [
    "Время для открытий",
    "math-time",
    "world-timeline",
    "russian-verb-forms",
    "english-weekdays",
    "literature-sequence",
  ],
  [
    "Геометрия вокруг нас",
    "math-geometry",
    "world-map",
    "russian-parts",
    "english-prepositions",
    "literature-figurative",
  ],
  [
    "Тропа природных связей",
    "math-multistep",
    "world-food-chains",
    "russian-checking-words",
    "english-have",
    "literature-theme",
  ],
  [
    "Мастерская точности",
    "math-units",
    "world-weather",
    "russian-cases",
    "english-articles",
    "literature-poetry",
  ],
  [
    "Путешествие по ленте истории",
    "math-money",
    "world-timeline",
    "russian-word-relations",
    "english-numbers",
    "literature-authors",
  ],
  [
    "Считаем, измеряем, объясняем",
    "math-mass",
    "world-weather",
    "russian-agreement",
    "english-plurals",
    "literature-characters",
  ],
  [
    "Часть и целое",
    "math-fractions",
    "world-space",
    "russian-roots",
    "english-present-simple",
    "literature-genres",
  ],
  [
    "Детективы верных решений",
    "math-logic",
    "world-directions",
    "russian-sentence",
    "english-have",
    "literature-reading",
  ],
  [
    "Первый большой рубеж",
    "math-multistep",
    "world-directions",
    "russian-cases",
    "english-present-simple",
    "literature-theme",
  ],
  [
    "Учимся обратным ходам",
    "math-equations",
    "world-centuries",
    "russian-verb-forms",
    "english-present-continuous",
    "literature-sequence",
  ],
  [
    "Магазин разумных покупок",
    "math-money",
    "world-weather",
    "russian-checking-words",
    "english-articles",
    "literature-characters",
  ],
  [
    "Точная карта нашего мира",
    "math-motion",
    "world-map",
    "russian-cases",
    "english-prepositions",
    "literature-reading",
  ],
  [
    "Секреты мастерской",
    "math-productivity",
    "world-food-chains",
    "russian-parts",
    "english-have",
    "literature-figurative",
  ],
  [
    "Ни один остаток не потеряется",
    "math-remainders",
    "world-food-chains",
    "russian-agreement",
    "english-plurals",
    "literature-genres",
  ],
  [
    "Время и история",
    "math-time",
    "world-timeline",
    "russian-verb-forms",
    "english-weekdays",
    "literature-authors",
  ],
  [
    "Проверяем каждый шаг",
    "math-order",
    "world-weather",
    "russian-checking-words",
    "english-present-simple",
    "literature-poetry",
  ],
  [
    "Измеряем неизвестное",
    "math-mass",
    "world-map",
    "russian-roots",
    "english-numbers",
    "literature-theme",
  ],
  [
    "Два способа одной задачи",
    "math-sum-difference",
    "world-centuries",
    "russian-sentence",
    "english-comparatives",
    "literature-characters",
  ],
  [
    "Конструктор форм и слов",
    "math-composite-geometry",
    "world-map",
    "russian-agreement",
    "english-prepositions",
    "literature-figurative",
  ],
  [
    "Тренировка без спешки",
    "math-equations",
    "world-space",
    "russian-cases",
    "english-be",
    "literature-reading",
  ],
  [
    "Доли, которые помогают",
    "math-fractions",
    "world-food-chains",
    "russian-word-relations",
    "english-have",
    "literature-poetry",
  ],
  [
    "Экватор приключения",
    "math-multistep",
    "world-timeline",
    "russian-verb-forms",
    "english-present-simple",
    "literature-theme",
  ],
  [
    "Связываем знания",
    "math-logic",
    "world-food-chains",
    "russian-sentence",
    "english-articles",
    "literature-reading",
  ],
  [
    "Путь экспедиции",
    "math-motion",
    "world-map",
    "russian-cases",
    "english-prepositions",
    "literature-sequence",
  ],
  [
    "Проект парка открытий",
    "math-geometry",
    "world-food-chains",
    "russian-parts",
    "english-present-continuous",
    "literature-figurative",
  ],
  [
    "Смета доброго дела",
    "math-money",
    "world-weather",
    "russian-checking-words",
    "english-numbers",
    "literature-characters",
  ],
  [
    "Лента памяти",
    "math-sum-difference",
    "world-timeline",
    "russian-verb-forms",
    "english-weekdays",
    "literature-authors",
  ],
  [
    "Лаборатория погоды",
    "math-units",
    "world-weather",
    "russian-agreement",
    "english-be",
    "literature-poetry",
  ],
  [
    "От плана к результату",
    "math-productivity",
    "world-centuries",
    "russian-sentence",
    "english-present-simple",
    "literature-theme",
  ],
  [
    "Как устроена большая команда",
    "math-remainders",
    "world-food-chains",
    "russian-roots",
    "english-plurals",
    "literature-genres",
  ],
  [
    "Путеводитель по космосу",
    "math-patterns",
    "world-space",
    "russian-word-relations",
    "english-comparatives",
    "literature-figurative",
  ],
  [
    "Читаем условия внимательно",
    "math-logic",
    "world-directions",
    "russian-cases",
    "english-articles",
    "literature-reading",
  ],
  [
    "Модель в масштабе",
    "math-composite-geometry",
    "world-map",
    "russian-agreement",
    "english-prepositions",
    "literature-sequence",
  ],
  [
    "Части общей работы",
    "math-fractions",
    "world-weather",
    "russian-verb-forms",
    "english-have",
    "literature-characters",
  ],
  [
    "Третья вершина",
    "math-multistep",
    "world-centuries",
    "russian-sentence",
    "english-present-continuous",
    "literature-theme",
  ],
  [
    "Самостоятельный маршрут",
    "math-equations",
    "world-directions",
    "russian-checking-words",
    "english-present-simple",
    "literature-reading",
  ],
  [
    "Оценить и проверить",
    "math-money",
    "world-weather",
    "russian-word-relations",
    "english-comparatives",
    "literature-poetry",
  ],
  [
    "Мастерская смысла",
    "math-sum-difference",
    "world-food-chains",
    "russian-sentence",
    "english-be",
    "literature-figurative",
  ],
  [
    "Экспедиция в прошлое",
    "math-time",
    "world-timeline",
    "russian-cases",
    "english-weekdays",
    "literature-authors",
  ],
  [
    "Точность в деталях",
    "math-units",
    "world-map",
    "russian-roots",
    "english-articles",
    "literature-reading",
  ],
  [
    "Продуманное решение",
    "math-remainders",
    "world-food-chains",
    "russian-verb-forms",
    "english-plurals",
    "literature-genres",
  ],
  [
    "Планируем новые открытия",
    "math-productivity",
    "world-weather",
    "russian-agreement",
    "english-have",
    "literature-sequence",
  ],
  [
    "Сила маленьких частей",
    "math-fractions",
    "world-space",
    "russian-checking-words",
    "english-present-continuous",
    "literature-characters",
  ],
  [
    "Карта собственных успехов",
    "math-geometry",
    "world-timeline",
    "russian-sentence",
    "english-prepositions",
    "literature-reading",
  ],
  [
    "Разные пути к ответу",
    "math-motion",
    "world-directions",
    "russian-word-relations",
    "english-comparatives",
    "literature-figurative",
  ],
  [
    "Главные открытия года",
    "math-patterns",
    "world-timeline",
    "russian-parts",
    "english-numbers",
    "literature-authors",
  ],
  [
    "Точность, логика, смысл",
    "math-logic",
    "world-food-chains",
    "russian-cases",
    "english-present-simple",
    "literature-theme",
  ],
  [
    "Большой годовой квест",
    "math-multistep",
    "world-centuries",
    "russian-verb-forms",
    "english-present-continuous",
    "literature-reading",
  ],
];
const subjectOrder: readonly SubjectId[] = [
  "math",
  "world",
  "russian",
  "english",
  "literature",
];
const phaseOrder: readonly YearPhase[] = [
  "discover",
  "practice",
  "connect",
  "master",
];
export const yearPlan: readonly WeekPlan[] = rows.map(
  ([title, ...topics], index) => {
    const week = index + 1;
    const phase = phaseOrder[Math.floor(index / 13)];
    const subjects = Object.fromEntries(
      subjectOrder.map((subject, position) => {
        const topic = topics[position];
        const definition = topicCatalog[topic];
        const skills =
          phase === "discover"
            ? definition.skills.slice(0, 2)
            : phase === "connect"
              ? [definition.skills[0], definition.skills[2]]
              : definition.skills.slice(1);
        return [subject, { title: definition.title, topic, skills }];
      }),
    ) as Record<SubjectId, WeekSubjectPlan>;
    return {
      week,
      title,
      phase,
      subjects,
      review: week % 4 === 0,
      checkpoint: week % 13 === 0,
    };
  },
);

export function getWeekPlan(week: number): WeekPlan {
  if (!Number.isInteger(week) || week < 1 || week > YEAR_WEEKS)
    throw new RangeError("Номер недели должен быть целым числом от 1 до 52.");
  return yearPlan[week - 1];
}
export function getQuestTheme(
  week: number,
  subject: SubjectId,
): WeekSubjectPlan {
  const plan = getWeekPlan(week).subjects[subject];
  if (!plan) throw new RangeError("Выберите один из пяти предметов.");
  return plan;
}

const DAY_MS = 24 * 60 * 60 * 1000;
function startDayNumber(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new RangeError("Дата начала должна иметь формат ГГГГ-ММ-ДД.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new RangeError("Укажите существующую дату начала.");
  return date.getTime() / DAY_MS;
}

/** Calendar position from the child's start date, not proof of completed work.
 * Calendar components avoid DST shifts shortening or lengthening a learning week.
 * All 52 weeks are 364 days; course completion itself is tracked from 260 quests.
 */
export function getYearPosition(
  startDate: string,
  now: Date = new Date(),
): { week: number; day: number; complete: boolean } {
  const start = startDayNumber(startDate);
  if (!Number.isFinite(now.getTime()))
    throw new RangeError("Текущая дата некорректна.");
  const current =
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS;
  const days = Math.max(0, current - start);
  const complete = days >= YEAR_WEEKS * 7;
  return {
    week: Math.min(YEAR_WEEKS, Math.floor(days / 7) + 1),
    day: complete ? 7 : (days % 7) + 1,
    complete,
  };
}
