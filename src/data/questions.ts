export type SubjectId = "math" | "world" | "russian" | "english" | "literature";

export interface Question {
  id: string;
  subject: SubjectId;
  prompt: string;
  choices: string[];
  answer: number;
  explanation: string;
  difficulty: 1 | 2 | 3;
}

export const subjects: {
  id: SubjectId;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  tag: string;
}[] = [
  {
    id: "math",
    title: "Математика",
    subtitle: "Петерсон · 4 класс",
    icon: "Calculator",
    color: "#7763ed",
    tag: "Считай и побеждай",
  },
  {
    id: "world",
    title: "Окружающий мир",
    subtitle: "Школа России · 4 класс",
    icon: "Globe2",
    color: "#2aa88b",
    tag: "Исследуй мир",
  },
  {
    id: "russian",
    title: "Русский язык",
    subtitle: "Школа России · 4 класс",
    icon: "Languages",
    color: "#ed9865",
    tag: "Найди верное слово",
  },
  {
    id: "english",
    title: "Английский язык",
    subtitle: "Английский · 4 класс",
    icon: "MessageCircle",
    color: "#5b9bdc",
    tag: "Let’s play!",
  },
  {
    id: "literature",
    title: "Литература",
    subtitle: "Школа России · 4 класс",
    icon: "BookOpen",
    color: "#d778a3",
    tag: "Открой новую историю",
  },
];

/** Original grade-four practice. Math emphasizes reasoning and multi-step tasks
 * in the spirit of Peterson; other Russian subjects follow common School of Russia themes.
 * These are independently authored tasks, not textbook excerpts or an official course.
 */
export const questions: Question[] = [
  {
    id: "math-01",
    subject: "math",
    difficulty: 1,
    prompt: "Вычисли: 480 : 6.",
    choices: ["80", "60", "8", "90"],
    answer: 0,
    explanation: "48 : 6 = 8, поэтому 480 : 6 = 80. Проверка: 80 × 6 = 480.",
  },
  {
    id: "math-02",
    subject: "math",
    difficulty: 2,
    prompt: "Вычисли удобным способом: 25 × 16.",
    choices: ["400", "300", "350", "425"],
    answer: 0,
    explanation:
      "Представим 16 как 4 × 4: 25 × 16 = (25 × 4) × 4 = 100 × 4 = 400.",
  },
  {
    id: "math-03",
    subject: "math",
    difficulty: 2,
    prompt: "Сначала подумай о порядке действий: 36 + 24 : 6 = ?",
    choices: ["40", "10", "60", "42"],
    answer: 0,
    explanation:
      "Сначала выполняем деление: 24 : 6 = 4. Затем сложение: 36 + 4 = 40.",
  },
  {
    id: "math-04",
    subject: "math",
    difficulty: 2,
    prompt:
      "Прямоугольник имеет длину 8 см и ширину 5 см. Чему равен его периметр?",
    choices: ["26 см", "40 см", "13 см", "26 см²"],
    answer: 0,
    explanation: "Периметр — сумма длин всех сторон: (8 + 5) × 2 = 26 см.",
  },
  {
    id: "math-05",
    subject: "math",
    difficulty: 2,
    prompt: "Длина прямоугольника 9 см, ширина 4 см. Чему равна его площадь?",
    choices: ["36 см²", "26 см²", "13 см²", "36 см"],
    answer: 0,
    explanation:
      "Площадь прямоугольника равна длине, умноженной на ширину: 9 × 4 = 36 см².",
  },
  {
    id: "math-06",
    subject: "math",
    difficulty: 1,
    prompt: "Сколько метров в 3 км 250 м?",
    choices: ["3250 м", "350 м", "3025 м", "32 500 м"],
    answer: 0,
    explanation: "В одном километре 1000 метров: 3 × 1000 + 250 = 3250 м.",
  },
  {
    id: "math-07",
    subject: "math",
    difficulty: 2,
    prompt:
      "Поезд ехал 3 часа со скоростью 60 км/ч. Какое расстояние он проехал?",
    choices: ["180 км", "20 км", "63 км", "120 км"],
    answer: 0,
    explanation:
      "Чтобы найти расстояние, умножаем скорость на время: 60 × 3 = 180 км.",
  },
  {
    id: "math-08",
    subject: "math",
    difficulty: 3,
    prompt: "Найди неизвестное число: (x + 15) : 5 = 12.",
    choices: ["45", "60", "75", "27"],
    answer: 0,
    explanation:
      "Решаем с конца: x + 15 = 12 × 5 = 60. Значит, x = 60 − 15 = 45.",
  },
  {
    id: "math-09",
    subject: "math",
    difficulty: 2,
    prompt:
      "В коробке 32 карандаша. Четверть из них — синие. Сколько синих карандашей?",
    choices: ["8", "4", "16", "24"],
    answer: 0,
    explanation:
      "Четверть — одна из четырёх равных частей: 32 : 4 = 8 карандашей.",
  },
  {
    id: "math-10",
    subject: "math",
    difficulty: 3,
    prompt:
      "У Миши 500 рублей. Он купил 3 тетради по 45 рублей. Сколько денег осталось?",
    choices: ["365 рублей", "455 рублей", "135 рублей", "355 рублей"],
    answer: 0,
    explanation:
      "Тетради стоят 45 × 3 = 135 рублей. Осталось 500 − 135 = 365 рублей.",
  },
  {
    id: "math-11",
    subject: "math",
    difficulty: 2,
    prompt:
      "Задумано число: 7 десятков тысяч, 3 сотни и 5 единиц. Остальные разряды — нули. Какое это число?",
    choices: ["70 305", "70 035", "70 053", "73 005"],
    answer: 0,
    explanation: "Складываем разрядные слагаемые: 70 000 + 300 + 5 = 70 305.",
  },
  {
    id: "math-12",
    subject: "math",
    difficulty: 2,
    prompt: "Урок начался в 10:20 и длился 45 минут. Во сколько он закончился?",
    choices: ["11:05", "10:65", "11:15", "11:00"],
    answer: 0,
    explanation: "До 11:00 пройдёт 40 минут, ещё 5 минут — получится 11:05.",
  },
  {
    id: "math-13",
    subject: "math",
    difficulty: 3,
    prompt: "Найди правило и продолжи цепочку: 3, 7, 15, 31, …",
    choices: ["63", "62", "47", "61"],
    answer: 0,
    explanation:
      "Каждое число умножаем на 2 и прибавляем 1: 3 × 2 + 1 = 7, 7 × 2 + 1 = 15. Далее 31 × 2 + 1 = 63.",
  },
  {
    id: "math-14",
    subject: "math",
    difficulty: 2,
    prompt: "Сколько граммов в 2 кг 80 г?",
    choices: ["2080 г", "280 г", "2800 г", "2008 г"],
    answer: 0,
    explanation: "В килограмме 1000 граммов: 2 × 1000 + 80 = 2080 г.",
  },
  {
    id: "math-15",
    subject: "math",
    difficulty: 3,
    prompt:
      "Из 96 книг треть — сказки. Остальные — рассказы. Сколько книг с рассказами?",
    choices: ["64", "32", "63", "48"],
    answer: 0,
    explanation: "Сказок 96 : 3 = 32. Книг с рассказами 96 − 32 = 64.",
  },
  {
    id: "math-16",
    subject: "math",
    difficulty: 3,
    prompt:
      "В двух автобусах по 36 мест. В них сели 58 ребят. Сколько мест осталось свободными?",
    choices: ["14", "22", "12", "10"],
    answer: 0,
    explanation: "Всего мест 36 × 2 = 72. Свободных мест 72 − 58 = 14.",
  },
  {
    id: "math-17",
    subject: "math",
    difficulty: 2,
    prompt: "Какое выражение равно 240?",
    choices: ["(90 − 30) × 4", "90 − 30 × 4", "90 + 30 × 4", "(90 + 30) : 4"],
    answer: 0,
    explanation: "В скобках 90 − 30 = 60. Затем 60 × 4 = 240.",
  },
  {
    id: "math-18",
    subject: "math",
    difficulty: 3,
    prompt:
      "В гонке участвовали 4 робота. Красный финишировал раньше синего, но позже зелёного. Жёлтый — после синего. Кто занял второе место?",
    choices: ["Красный", "Зелёный", "Синий", "Жёлтый"],
    answer: 0,
    explanation:
      "Порядок такой: зелёный, красный, синий, жёлтый. Значит, вторым финишировал красный робот.",
  },
  {
    id: "math-19",
    subject: "math",
    difficulty: 3,
    prompt:
      "Садовник посадил 5 рядов по 12 яблонь и 3 ряда по 8 груш. Сколько всего деревьев?",
    choices: ["84", "80", "60", "96"],
    answer: 0,
    explanation:
      "Яблонь 5 × 12 = 60, груш 3 × 8 = 24. Всего 60 + 24 = 84 дерева.",
  },
  {
    id: "math-20",
    subject: "math",
    difficulty: 2,
    prompt: "Периметр квадрата равен 28 см. Чему равна длина его стороны?",
    choices: ["7 см", "14 см", "4 см", "24 см"],
    answer: 0,
    explanation: "У квадрата четыре равные стороны. 28 : 4 = 7 см.",
  },

  {
    id: "world-01",
    subject: "world",
    difficulty: 1,
    prompt: "Какая планета находится ближе всего к Солнцу?",
    choices: ["Меркурий", "Земля", "Марс", "Юпитер"],
    answer: 0,
    explanation:
      "Меркурий — первая планета от Солнца. Затем идут Венера и Земля.",
  },
  {
    id: "world-02",
    subject: "world",
    difficulty: 2,
    prompt:
      "Как звали русского первопечатника, выпустившего в Москве книгу «Апостол» в 1564 году вместе с Петром Мстиславцем?",
    choices: [
      "Иван Фёдоров",
      "Михаил Ломоносов",
      "Юрий Гагарин",
      "Дмитрий Менделеев",
    ],
    answer: 0,
    explanation:
      "Иван Фёдоров и Пётр Мстиславец напечатали «Апостол» — первую точно датированную московскую печатную книгу.",
  },
  {
    id: "world-03",
    subject: "world",
    difficulty: 2,
    prompt: "Какое звено пропущено в цепи питания: трава → … → лиса?",
    choices: ["Заяц", "Дуб", "Солнце", "Волк"],
    answer: 0,
    explanation:
      "Заяц питается травой, а лиса может охотиться на зайца. Стрелка показывает, кто кому служит пищей.",
  },
  {
    id: "world-04",
    subject: "world",
    difficulty: 1,
    prompt: "Какой орган человека перекачивает кровь?",
    choices: ["Сердце", "Желудок", "Лёгкие", "Печень"],
    answer: 0,
    explanation:
      "Сердце работает как насос: его сокращения заставляют кровь двигаться по сосудам.",
  },
  {
    id: "world-05",
    subject: "world",
    difficulty: 2,
    prompt: "Почему день сменяется ночью?",
    choices: [
      "Земля вращается вокруг своей оси",
      "Солнце каждый день гаснет",
      "Луна закрывает Солнце каждую ночь",
      "Земля останавливается ночью",
    ],
    answer: 0,
    explanation:
      "Земля вращается вокруг своей оси. На освещённой Солнцем стороне день, на противоположной — ночь.",
  },
  {
    id: "world-06",
    subject: "world",
    difficulty: 1,
    prompt: "Какой прибор помогает определить стороны горизонта?",
    choices: ["Компас", "Термометр", "Весы", "Секундомер"],
    answer: 0,
    explanation:
      "Магнитная стрелка компаса помогает определить направление на север и другие стороны горизонта.",
  },
  {
    id: "world-07",
    subject: "world",
    difficulty: 2,
    prompt: "При каком князе произошло Крещение Руси в 988 году?",
    choices: [
      "При Владимире",
      "При Юрии Долгоруком",
      "При Александре Невском",
      "При Дмитрии Донском",
    ],
    answer: 0,
    explanation:
      "Крещение Руси связывают с князем Владимиром Святославичем и 988 годом. Это важное событие истории Древней Руси.",
  },
  {
    id: "world-08",
    subject: "world",
    difficulty: 2,
    prompt: "Что такое летопись?",
    choices: [
      "Запись исторических событий по годам",
      "Прибор для измерения времени",
      "Только карта морских путешествий",
      "Список покупок на лето",
    ],
    answer: 0,
    explanation:
      "В летописях события записывали по годам. Слово «лето» в старину могло означать «год». Летописи помогают изучать историю.",
  },
  {
    id: "world-09",
    subject: "world",
    difficulty: 2,
    prompt: "Что растения обычно поглощают из воздуха при фотосинтезе?",
    choices: ["Углекислый газ", "Песок", "Водяной лёд", "Поваренную соль"],
    answer: 0,
    explanation:
      "На свету растения используют углекислый газ и воду для образования питательных веществ и выделяют кислород.",
  },
  {
    id: "world-10",
    subject: "world",
    difficulty: 1,
    prompt: "Как называется столица России?",
    choices: ["Москва", "Казань", "Санкт-Петербург", "Новосибирск"],
    answer: 0,
    explanation:
      "Москва — столица Российской Федерации. Здесь находятся основные органы государственной власти.",
  },
  {
    id: "world-11",
    subject: "world",
    difficulty: 2,
    prompt: "Какая природная зона расположена севернее тайги?",
    choices: ["Тундра", "Степь", "Пустыня", "Саванна"],
    answer: 0,
    explanation:
      "Тундра находится севернее тайги. Там холодно, а из растений распространены мхи, лишайники и невысокие кустарники.",
  },
  {
    id: "world-12",
    subject: "world",
    difficulty: 2,
    prompt: "Что на физической карте обычно обозначают синим цветом?",
    choices: ["Водоёмы", "Высокие горы", "Города", "Пустыни"],
    answer: 0,
    explanation:
      "Синим и голубым на физических картах обозначают океаны, моря, реки и озёра.",
  },
  {
    id: "world-13",
    subject: "world",
    difficulty: 1,
    prompt: "Какое из этих животных — млекопитающее?",
    choices: ["Дельфин", "Щука", "Карась", "Акула"],
    answer: 0,
    explanation:
      "Дельфин дышит лёгкими и выкармливает детёнышей молоком. Поэтому он млекопитающее, хотя живёт в воде.",
  },
  {
    id: "world-14",
    subject: "world",
    difficulty: 3,
    prompt: "Почему при уборке леса нельзя уносить из него всю опавшую листву?",
    choices: [
      "Листва превращается в перегной и служит укрытием живым существам",
      "Из каждого листа вырастает новое дерево",
      "Листва не пропускает дождь в лес",
      "Без листвы лес сразу перестаёт получать свет",
    ],
    answer: 0,
    explanation:
      "Опавшую листву разлагают грибы и другие организмы. Она обогащает почву и даёт укрытие мелким животным.",
  },
  {
    id: "world-15",
    subject: "world",
    difficulty: 2,
    prompt: "Какое полезное ископаемое используют для производства бензина?",
    choices: ["Нефть", "Гранит", "Мел", "Песок"],
    answer: 0,
    explanation:
      "На заводах нефть перерабатывают и получают бензин и другие продукты.",
  },
  {
    id: "world-16",
    subject: "world",
    difficulty: 2,
    prompt: "Что такое заповедник?",
    choices: [
      "Территория, где охраняют природные комплексы",
      "Место для добычи всех полезных ископаемых",
      "Парк только с аттракционами",
      "Участок для строительства заводов",
    ],
    answer: 0,
    explanation:
      "В заповедниках сохраняют природу и изучают её. Хозяйственная деятельность там строго ограничена.",
  },
  {
    id: "world-17",
    subject: "world",
    difficulty: 2,
    prompt: "Какой город расположен на реке Неве и был основан Петром I?",
    choices: ["Санкт-Петербург", "Москва", "Владимир", "Ярославль"],
    answer: 0,
    explanation:
      "Пётр I основал Санкт-Петербург в 1703 году на Неве. Позже город стал столицей Российской империи.",
  },
  {
    id: "world-18",
    subject: "world",
    difficulty: 3,
    prompt: "Что показывает масштаб карты «в 1 см — 10 км»?",
    choices: [
      "1 см на карте соответствует 10 км на местности",
      "Любая река имеет длину 10 км",
      "Вся карта имеет ширину 10 км",
      "1 км на местности равен 10 см на карте",
    ],
    answer: 0,
    explanation:
      "Масштаб связывает расстояние на карте и на местности: например, 3 см на такой карте — это 30 км.",
  },
  {
    id: "world-19",
    subject: "world",
    difficulty: 1,
    prompt: "Какой номер можно набрать в России для вызова экстренных служб?",
    choices: ["112", "123", "555", "9999"],
    answer: 0,
    explanation:
      "112 — единый номер вызова экстренных служб. Звонить нужно при настоящей опасности, а не ради шутки.",
  },
  {
    id: "world-20",
    subject: "world",
    difficulty: 2,
    prompt: "Как называется основной закон Российской Федерации?",
    choices: ["Конституция", "Красная книга", "Атлас", "Толковый словарь"],
    answer: 0,
    explanation:
      "Конституция — основной закон страны. В ней закреплены основы государственного устройства, права и свободы человека.",
  },

  {
    id: "russian-01",
    subject: "russian",
    difficulty: 1,
    prompt: "Какое слово — имя существительное?",
    choices: ["Радость", "Радостный", "Радоваться", "Радостно"],
    answer: 0,
    explanation:
      "«Радость» обозначает чувство и отвечает на вопрос «что?». Это имя существительное.",
  },
  {
    id: "russian-02",
    subject: "russian",
    difficulty: 1,
    prompt: "Какое слово — имя прилагательное?",
    choices: ["Лесной", "Лес", "Лесник", "Лесок"],
    answer: 0,
    explanation:
      "«Лесной» обозначает признак предмета и отвечает на вопрос «какой?».",
  },
  {
    id: "russian-03",
    subject: "russian",
    difficulty: 2,
    prompt: "Какое слово проверяет безударную гласную в слове «леса́»?",
    choices: ["Лес", "Лесно́й", "Лесни́к", "Лесови́к"],
    answer: 0,
    explanation:
      "В проверочном слове «лес» гласная е стоит под ударением, поэтому её хорошо слышно.",
  },
  {
    id: "russian-04",
    subject: "russian",
    difficulty: 2,
    prompt: "В каком слове нужен разделительный твёрдый знак?",
    choices: ["Под…езд", "В…юга", "Сем…я", "Руч…и"],
    answer: 0,
    explanation:
      "«Подъезд» пишется с ъ после приставки под- перед буквой е. Остальные слова пишутся с разделительным ь.",
  },
  {
    id: "russian-05",
    subject: "russian",
    difficulty: 2,
    prompt: "В каком падеже стоит слово «книгу» в предложении «Я читаю книгу»?",
    choices: [
      "В винительном",
      "В именительном",
      "В дательном",
      "В творительном",
    ],
    answer: 0,
    explanation:
      "Читаю что? Книгу. Это винительный падеж: вопросы «кого? что?».",
  },
  {
    id: "russian-06",
    subject: "russian",
    difficulty: 1,
    prompt: "Выбери правильное написание.",
    choices: ["Жираф", "Жыраф", "Жераф", "Жирафь"],
    answer: 0,
    explanation: "Сочетания жи и ши пишутся с буквой и: жираф, машина, лыжи.",
  },
  {
    id: "russian-07",
    subject: "russian",
    difficulty: 2,
    prompt: "Найди грамматическую основу: «На ветке громко пел соловей».",
    choices: ["Соловей пел", "На ветке пел", "Громко пел", "На ветке соловей"],
    answer: 0,
    explanation:
      "Кто? Соловей — подлежащее. Что делал? Пел — сказуемое. Вместе они образуют основу предложения.",
  },
  {
    id: "russian-08",
    subject: "russian",
    difficulty: 2,
    prompt: "Какое слово является антонимом к слову «смелый»?",
    choices: ["Трусливый", "Храбрый", "Отважный", "Бесстрашный"],
    answer: 0,
    explanation:
      "Антонимы имеют противоположное значение. «Смелый» и «трусливый» — антонимы.",
  },
  {
    id: "russian-09",
    subject: "russian",
    difficulty: 2,
    prompt: "Укажи глагол прошедшего времени.",
    choices: ["Построил", "Строит", "Построит", "Будет строить"],
    answer: 0,
    explanation:
      "«Построил» отвечает на вопрос «что сделал?» и обозначает действие, которое уже произошло.",
  },
  {
    id: "russian-10",
    subject: "russian",
    difficulty: 3,
    prompt: "В каком слове в окончании нужно написать е?",
    choices: ["О деревн…", "Нет деревн…", "Из деревн…", "Около деревн…"],
    answer: 0,
    explanation:
      "«О деревне» — предложный падеж существительного первого склонения, окончание -е. В остальных примерах — родительный падеж, окончание -и.",
  },
  {
    id: "russian-11",
    subject: "russian",
    difficulty: 1,
    prompt: "Какой род у существительного «солнце»?",
    choices: ["Средний", "Мужской", "Женский", "У этого слова нет рода"],
    answer: 0,
    explanation: "Солнце — оно, моё. Это существительное среднего рода.",
  },
  {
    id: "russian-12",
    subject: "russian",
    difficulty: 2,
    prompt: "Какое слово является синонимом к слову «огромный»?",
    choices: ["Громадный", "Крошечный", "Узкий", "Низкий"],
    answer: 0,
    explanation:
      "Синонимы близки по значению. «Огромный» и «громадный» означают очень большой.",
  },
  {
    id: "russian-13",
    subject: "russian",
    difficulty: 2,
    prompt: "Выбери правильное написание глагола с частицей не.",
    choices: ["Не знаю", "Незнаю", "Не-знаю", "Ни знаю"],
    answer: 0,
    explanation:
      "Частица не с глаголами обычно пишется раздельно: не знаю, не бегал, не прочитаю.",
  },
  {
    id: "russian-14",
    subject: "russian",
    difficulty: 3,
    prompt: "Какое окончание у глагола «читать» в форме «ты чита…»?",
    choices: ["-ешь", "-ишь", "-ете", "-ем"],
    answer: 0,
    explanation:
      "Глагол «читать» относится к первому спряжению. Во втором лице единственного числа: ты читаешь, окончание -ешь.",
  },
  {
    id: "russian-15",
    subject: "russian",
    difficulty: 2,
    prompt: "В каком слове все согласные звуки твёрдые?",
    choices: ["Кот", "Кит", "Мяч", "Лес"],
    answer: 0,
    explanation:
      "В слове «кот» звуки [к] и [т] твёрдые. В остальных словах есть мягкий согласный.",
  },
  {
    id: "russian-16",
    subject: "russian",
    difficulty: 2,
    prompt: "Какой корень у слова «подводный»?",
    choices: ["-вод-", "-под-", "-водн-", "-ный"],
    answer: 0,
    explanation:
      "Родственные слова: вода, водный, подводный. Их общая значимая часть — корень -вод-.",
  },
  {
    id: "russian-17",
    subject: "russian",
    difficulty: 3,
    prompt: "Выбери предложение с однородными подлежащими.",
    choices: [
      "В саду росли яблони и груши.",
      "Птица взлетела и запела.",
      "Мы гуляли в большом саду.",
      "С утра шёл сильный дождь.",
    ],
    answer: 0,
    explanation:
      "Что росло? Яблони и груши. Они отвечают на один вопрос, относятся к одному сказуемому и являются однородными подлежащими.",
  },
  {
    id: "russian-18",
    subject: "russian",
    difficulty: 2,
    prompt: "В каком слове ударение падает на второй слог?",
    choices: ["Звони́т", "То́рты", "Ба́нты", "Сре́дства"],
    answer: 0,
    explanation:
      "Правильно говорить «звони́т». В словах «то́рты», «ба́нты», «сре́дства» ударение падает на первый слог.",
  },
  {
    id: "russian-19",
    subject: "russian",
    difficulty: 1,
    prompt: "Какое слово — личное местоимение?",
    choices: ["Они", "Три", "Лес", "Добрый"],
    answer: 0,
    explanation:
      "«Они» — личное местоимение третьего лица множественного числа. Оно указывает на предметы или людей, не называя их.",
  },
  {
    id: "russian-20",
    subject: "russian",
    difficulty: 3,
    prompt: "Почему в слове «ночь» на конце пишется мягкий знак?",
    choices: [
      "Это существительное женского рода после шипящего",
      "Чтобы сделать звук ч мягким",
      "Это существительное мужского рода",
      "Это глагол второго лица",
    ],
    answer: 0,
    explanation:
      "У существительных женского рода после шипящего на конце пишется ь: ночь, мышь. Звук [ч’] и без того всегда мягкий.",
  },

  {
    id: "english-01",
    subject: "english",
    difficulty: 1,
    prompt: "Выбери правильное слово: «She … my sister».",
    choices: ["is", "am", "are", "be"],
    answer: 0,
    explanation:
      "С she, he и it употребляется is: She is my sister — «Она моя сестра».",
  },
  {
    id: "english-02",
    subject: "english",
    difficulty: 1,
    prompt: "Как по-английски «библиотека»?",
    choices: ["Library", "Bookshop", "Kitchen", "Hospital"],
    answer: 0,
    explanation:
      "Library — библиотека. Bookshop — книжный магазин, kitchen — кухня, hospital — больница.",
  },
  {
    id: "english-03",
    subject: "english",
    difficulty: 2,
    prompt: "Заполни пропуск: «My brother … football every Saturday».",
    choices: ["plays", "play", "playing", "to play"],
    answer: 0,
    explanation:
      "В Present Simple с he, she, it к глаголу обычно добавляют -s: My brother plays football.",
  },
  {
    id: "english-04",
    subject: "english",
    difficulty: 2,
    prompt: "Как сказать «У меня есть два брата»?",
    choices: [
      "I have got two brothers.",
      "I has got two brothers.",
      "I am two brothers.",
      "I have got two brother.",
    ],
    answer: 0,
    explanation:
      "С I используется have got. После two существительное ставим во множественное число: brothers.",
  },
  {
    id: "english-05",
    subject: "english",
    difficulty: 1,
    prompt: "Какое слово обозначает среду — день недели?",
    choices: ["Wednesday", "Thursday", "Tuesday", "Sunday"],
    answer: 0,
    explanation:
      "Wednesday — среда. Tuesday — вторник, Thursday — четверг, Sunday — воскресенье.",
  },
  {
    id: "english-06",
    subject: "english",
    difficulty: 2,
    prompt: "Выбери множественное число слова «child».",
    choices: ["Children", "Childs", "Childes", "Childrens"],
    answer: 0,
    explanation:
      "Child — ребёнок, children — дети. Это особая форма множественного числа, её нужно запомнить.",
  },
  {
    id: "english-07",
    subject: "english",
    difficulty: 2,
    prompt: "Выбери слово: «There … three apples on the table».",
    choices: ["are", "is", "am", "has"],
    answer: 0,
    explanation:
      "Для нескольких предметов используем there are: There are three apples — «На столе три яблока».",
  },
  {
    id: "english-08",
    subject: "english",
    difficulty: 2,
    prompt: "Как правильно спросить «Ты умеешь плавать?»",
    choices: [
      "Can you swim?",
      "You can to swim?",
      "Do you can swim?",
      "Can you swimming?",
    ],
    answer: 0,
    explanation:
      "В вопросе can ставится перед you. После can идёт глагол без to: Can you swim?",
  },
  {
    id: "english-09",
    subject: "english",
    difficulty: 1,
    prompt: "Прочитай: «The cat is under the chair». Где кошка?",
    choices: ["Под стулом", "На стуле", "За столом", "Рядом с дверью"],
    answer: 0,
    explanation: "Under означает «под», chair — «стул»: кошка под стулом.",
  },
  {
    id: "english-10",
    subject: "english",
    difficulty: 3,
    prompt: "Выбери правильное слово: «Yesterday we … to the park».",
    choices: ["went", "go", "goes", "going"],
    answer: 0,
    explanation:
      "Yesterday — вчера, значит нужно прошедшее время. У глагола go форма прошедшего времени — went.",
  },
  {
    id: "english-11",
    subject: "english",
    difficulty: 2,
    prompt: "Какое слово пропущено: «An elephant is … than a mouse»?",
    choices: ["bigger", "big", "smallest", "biggest"],
    answer: 0,
    explanation:
      "Сравниваем двух животных. Bigger than — «больше, чем»: слон больше мыши.",
  },
  {
    id: "english-12",
    subject: "english",
    difficulty: 1,
    prompt: "Какое слово нужно: «This is … orange»?",
    choices: ["an", "a", "two", "are"],
    answer: 0,
    explanation:
      "Перед словом, начинающимся с гласного звука, используется an: an orange.",
  },
  {
    id: "english-13",
    subject: "english",
    difficulty: 2,
    prompt: "Выбери отрицательное предложение.",
    choices: [
      "He does not like milk.",
      "He do not like milk.",
      "He does not likes milk.",
      "He not likes milk.",
    ],
    answer: 0,
    explanation:
      "С he в Present Simple используем does not, а основной глагол остаётся без -s: does not like.",
  },
  {
    id: "english-14",
    subject: "english",
    difficulty: 1,
    prompt: "Какое число означает «forty»?",
    choices: ["40", "14", "4", "44"],
    answer: 0,
    explanation:
      "Forty — сорок. Fourteen — четырнадцать, four — четыре, forty-four — сорок четыре.",
  },
  {
    id: "english-15",
    subject: "english",
    difficulty: 3,
    prompt: "Заполни пропуск: «Look! The birds … in the sky».",
    choices: ["are flying", "is flying", "flies", "fly yesterday"],
    answer: 0,
    explanation:
      "Look! подсказывает: действие происходит сейчас. Для нескольких птиц: are flying — «летят».",
  },
  {
    id: "english-16",
    subject: "english",
    difficulty: 2,
    prompt: "Прочитай: «Tom has a dog. Its name is Spot». Как зовут собаку?",
    choices: ["Spot", "Tom", "Dog", "Name"],
    answer: 0,
    explanation:
      "Its name is Spot означает «Её зовут Спот». Tom — имя хозяина.",
  },
  {
    id: "english-17",
    subject: "english",
    difficulty: 2,
    prompt: "Выбери правильный вопрос: «… do you live?» — «In Moscow».",
    choices: ["Where", "When", "Who", "How old"],
    answer: 0,
    explanation: "Where — «где?». Where do you live? — «Где ты живёшь?».",
  },
  {
    id: "english-18",
    subject: "english",
    difficulty: 1,
    prompt: "Как ответить на «Thank you!»?",
    choices: ["You’re welcome!", "Good night!", "I’m ten.", "It is blue."],
    answer: 0,
    explanation:
      "You’re welcome! — вежливый ответ «Пожалуйста!» на благодарность.",
  },
  {
    id: "english-19",
    subject: "english",
    difficulty: 2,
    prompt: "Сейчас 7:30. Как сказать это по-английски?",
    choices: [
      "It’s half past seven.",
      "It’s half past eight.",
      "It’s seven o’clock.",
      "It’s a quarter past seven.",
    ],
    answer: 0,
    explanation:
      "Half past seven — буквально «половина часа после семи», то есть 7:30.",
  },
  {
    id: "english-20",
    subject: "english",
    difficulty: 3,
    prompt:
      "Прочитай: «Kate gets up at seven. She has breakfast at half past seven». Во сколько Кейт завтракает?",
    choices: ["В 7:30", "В 7:00", "В 8:30", "В 6:30"],
    answer: 0,
    explanation:
      "Has breakfast означает «завтракает», а half past seven — 7:30. В 7:00 Кейт только встаёт.",
  },

  {
    id: "literature-01",
    subject: "literature",
    difficulty: 1,
    prompt: "Кто написал «Сказку о мёртвой царевне и о семи богатырях»?",
    choices: [
      "Александр Пушкин",
      "Иван Крылов",
      "Николай Носов",
      "Самуил Маршак",
    ],
    answer: 0,
    explanation:
      "Эту сказку в стихах написал Александр Сергеевич Пушкин. В ней рассказывается о царевне, завистливой царице и верности королевича Елисея.",
  },
  {
    id: "literature-02",
    subject: "literature",
    difficulty: 2,
    prompt:
      "Как называется короткое поучительное произведение, часто с героями-животными и моралью?",
    choices: ["Басня", "Былина", "Загадка", "Скороговорка"],
    answer: 0,
    explanation:
      "Басня высмеивает недостатки и учит на примере. Её поучительный вывод называется моралью.",
  },
  {
    id: "literature-03",
    subject: "literature",
    difficulty: 1,
    prompt: "Кто автор рассказов о Дениске Кораблёве?",
    choices: [
      "Виктор Драгунский",
      "Александр Пушкин",
      "Иван Крылов",
      "Сергей Есенин",
    ],
    answer: 0,
    explanation:
      "Виктор Драгунский написал «Денискины рассказы» — весёлые и поучительные истории о Дениске и его друзьях.",
  },
  {
    id: "literature-04",
    subject: "literature",
    difficulty: 2,
    prompt: "Что такое рифма?",
    choices: [
      "Созвучие окончаний стихотворных строк",
      "Список героев рассказа",
      "Название главы",
      "Объяснение незнакомого слова",
    ],
    answer: 0,
    explanation:
      "Рифма — созвучие окончаний строк. Например, слова «дорожка» и «кошка» могут рифмоваться.",
  },
  {
    id: "literature-05",
    subject: "literature",
    difficulty: 2,
    prompt: "Что обычно отличает народную сказку от авторской?",
    choices: [
      "Она создана народом и передавалась от рассказчика к рассказчику",
      "Она обязательно написана в стихах",
      "В ней не бывает животных",
      "Она всегда рассказывает о космосе",
    ],
    answer: 0,
    explanation:
      "Народные сказки долго передавали устно. У них нет одного известного автора, в отличие от авторских сказок.",
  },
  {
    id: "literature-06",
    subject: "literature",
    difficulty: 2,
    prompt: "Кто автор сказа «Серебряное копытце»?",
    choices: [
      "Павел Бажов",
      "Алексей Толстой",
      "Александр Волков",
      "Корней Чуковский",
    ],
    answer: 0,
    explanation:
      "Павел Петрович Бажов написал сказ «Серебряное копытце» о Дарёнке, Коковане и чудесном козлике.",
  },
  {
    id: "literature-07",
    subject: "literature",
    difficulty: 3,
    prompt:
      "Какой художественный приём использован в выражении «ветер шепчет»?",
    choices: ["Олицетворение", "Рифма", "Перечисление", "Заголовок"],
    answer: 0,
    explanation:
      "Ветру приписано человеческое действие — он будто умеет шептать. Такой приём называется олицетворением.",
  },
  {
    id: "literature-08",
    subject: "literature",
    difficulty: 2,
    prompt: "Кто написал басню «Стрекоза и Муравей»?",
    choices: [
      "Иван Крылов",
      "Николай Некрасов",
      "Корней Чуковский",
      "Борис Житков",
    ],
    answer: 0,
    explanation:
      "«Стрекоза и Муравей» — басня Ивана Андреевича Крылова о беспечности и труде.",
  },
  {
    id: "literature-09",
    subject: "literature",
    difficulty: 2,
    prompt: "Что называют темой произведения?",
    choices: [
      "То, о чём рассказывается в произведении",
      "Только имя его автора",
      "Количество страниц",
      "Цвет обложки",
    ],
    answer: 0,
    explanation:
      "Тема отвечает на вопрос «о чём произведение?». Например, о дружбе, природе или путешествии.",
  },
  {
    id: "literature-10",
    subject: "literature",
    difficulty: 2,
    prompt: "Что означает пословица «Без труда не вытащишь и рыбку из пруда»?",
    choices: [
      "Чтобы добиться результата, нужно потрудиться",
      "Ловить рыбу всегда запрещено",
      "Любую работу можно сделать без усилий",
      "Рыба живёт только в прудах",
    ],
    answer: 0,
    explanation:
      "Пословица говорит не только о рыбалке: она учит, что достижение цели требует усилий.",
  },
  {
    id: "literature-11",
    subject: "literature",
    difficulty: 2,
    prompt: "Кто написал сказку в стихах «Конёк-Горбунок»?",
    choices: ["Пётр Ершов", "Николай Носов", "Лев Толстой", "Сергей Михалков"],
    answer: 0,
    explanation:
      "«Конёк-Горбунок» — сказка Петра Павловича Ершова. Маленький волшебный конёк помогает своему другу Ивану.",
  },
  {
    id: "literature-12",
    subject: "literature",
    difficulty: 2,
    prompt: "Как называется описание природы в литературном произведении?",
    choices: ["Пейзаж", "Портрет", "Диалог", "Оглавление"],
    answer: 0,
    explanation:
      "Пейзаж — описание природы: леса, поля, неба, погоды. Он помогает представить место и настроение действия.",
  },
  {
    id: "literature-13",
    subject: "literature",
    difficulty: 2,
    prompt: "Что такое диалог?",
    choices: [
      "Разговор двух или нескольких героев",
      "Описание внешности героя",
      "Список глав книги",
      "Мысли автора только о погоде",
    ],
    answer: 0,
    explanation:
      "Диалог — обмен репликами между собеседниками. Он помогает узнать характеры героев и понять события.",
  },
  {
    id: "literature-14",
    subject: "literature",
    difficulty: 2,
    prompt: "Кто автор сказки «Русалочка»?",
    choices: [
      "Ханс Кристиан Андерсен",
      "Астрид Линдгрен",
      "Шарль Перро",
      "Редьярд Киплинг",
    ],
    answer: 0,
    explanation:
      "Сказку «Русалочка» написал датский писатель Ханс Кристиан Андерсен. Ему также принадлежат «Снежная королева» и «Гадкий утёнок».",
  },
  {
    id: "literature-15",
    subject: "literature",
    difficulty: 3,
    prompt: "В каком выражении есть сравнение?",
    choices: [
      "Снег блестел, как серебро.",
      "Снег лежал на земле.",
      "Пошёл первый снег.",
      "Снег растаял к полудню.",
    ],
    answer: 0,
    explanation:
      "Снег сравнивается с серебром по блеску. Союз «как» помогает заметить сравнение.",
  },
  {
    id: "literature-16",
    subject: "literature",
    difficulty: 2,
    prompt: "Как называют главную мысль произведения?",
    choices: [
      "То главное, что автор хочет донести до читателя",
      "Первое слово на первой странице",
      "Фамилию главного героя",
      "Любую длинную реплику",
    ],
    answer: 0,
    explanation:
      "Главная мысль — основная идея произведения, то, ради чего автор рассказывает историю и над чем предлагает задуматься.",
  },
  {
    id: "literature-17",
    subject: "literature",
    difficulty: 2,
    prompt: "Кто автор сказки «Городок в табакерке»?",
    choices: [
      "Владимир Одоевский",
      "Корней Чуковский",
      "Михаил Пришвин",
      "Агния Барто",
    ],
    answer: 0,
    explanation:
      "Владимир Фёдорович Одоевский написал «Городок в табакерке». Мальчик Миша отправляется в воображаемый мир музыкального механизма.",
  },
  {
    id: "literature-18",
    subject: "literature",
    difficulty: 3,
    prompt:
      "Прочитай: «Саша нашёл чужой кошелёк и отнёс его учителю». Какое качество показывает этот поступок?",
    choices: ["Честность", "Жадность", "Хвастливость", "Лень"],
    answer: 0,
    explanation:
      "Саша не присвоил чужую вещь, а помог вернуть её владельцу. Такой поступок показывает честность.",
  },
  {
    id: "literature-19",
    subject: "literature",
    difficulty: 2,
    prompt:
      "Какой жанр рассказывает о подвигах богатырей в народной поэтической форме?",
    choices: ["Былина", "Скороговорка", "Загадка", "Считалка"],
    answer: 0,
    explanation:
      "Былины — народные эпические песни-сказания. Их герои — богатыри, например Илья Муромец.",
  },
  {
    id: "literature-20",
    subject: "literature",
    difficulty: 2,
    prompt: "Что поможет найти страницу с нужной главой в книге?",
    choices: [
      "Оглавление",
      "Только цвет обложки",
      "Имя художника",
      "Цена книги",
    ],
    answer: 0,
    explanation:
      "В оглавлении перечислены главы или произведения и указаны страницы, с которых они начинаются.",
  },
];

function randomGenerator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(source: readonly T[], random: () => number): T[] {
  const result = [...source];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

/** A shared seed reproduces both question order and answer positions for a duel.
 * Mixed rounds balance the subjects: every complete group of five covers all five.
 * Source questions and choices are never modified.
 */
export function getQuestions(
  subject: SubjectId | "mixed",
  count = 8,
  seed?: number,
): Question[] {
  const random = seed === undefined ? Math.random : randomGenerator(seed);
  const limit = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 8;
  let selected: Question[];
  if (subject === "mixed") {
    const pools = subjects.map(({ id }) =>
      shuffled(
        questions.filter((question) => question.subject === id),
        random,
      ),
    );
    selected = [];
    const maximum = Math.min(limit, questions.length);
    let round = 0;
    while (selected.length < maximum) {
      for (const poolIndex of shuffled(
        pools.map((_, index) => index),
        random,
      )) {
        const question = pools[poolIndex][round];
        if (question && selected.length < maximum) selected.push(question);
      }
      round += 1;
    }
  } else {
    selected = shuffled(
      questions.filter((question) => question.subject === subject),
      random,
    ).slice(0, limit);
  }
  return selected.map((question) => {
    const choiceOrder = shuffled(
      question.choices.map((_, index) => index),
      random,
    );
    return {
      ...question,
      choices: choiceOrder.map((index) => question.choices[index]),
      answer: choiceOrder.indexOf(question.answer),
    };
  });
}
