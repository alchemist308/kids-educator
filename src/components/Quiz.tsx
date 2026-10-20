import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Flag,
  Lightbulb,
  LoaderCircle,
  RotateCcw,
  Star,
  X,
} from "lucide-react";
import { subjects } from "../data/questions";
import type { Question, SubjectId } from "../data/questions";
import type { DeviceLearningEvent } from "../family-contract";

export default function Quiz({
  subject,
  level,
  week,
  onClose,
  onAnswer,
  onFinish,
  onTrack,
}: {
  subject: SubjectId | "mixed";
  level: number;
  week?: number;
  onClose: () => void;
  onAnswer: (
    question: Question,
    correct: boolean,
  ) => { earned: number; levelUp: boolean };
  onFinish: (
    subject: SubjectId | "mixed",
    correct: number,
    total: number,
  ) => void;
  onTrack?: (event: DeviceLearningEvent) => void;
}) {
  const [items, setItems] = useState<Question[]>([]);
  const [initialLevel] = useState(level);
  const [requestId, setRequestId] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [xp, setXp] = useState(0);
  const [lastEarned, setLastEarned] = useState(0);
  const [levelUp, setLevelUp] = useState(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const quizId = useRef(crypto.randomUUID());
  const tracking = useRef(onTrack);
  tracking.current = onTrack;
  const timing = useRef({ elapsed: 0, since: 0, total: 0 });
  useEffect(() => {
    timing.current.elapsed = 0;
    timing.current.since =
      !loading &&
      !done &&
      selected === null &&
      document.visibilityState === "visible"
        ? performance.now()
        : 0;
    const visibility = () => {
      const clock = timing.current;
      if (clock.since) clock.elapsed += performance.now() - clock.since;
      clock.since =
        !loading &&
        !done &&
        selected === null &&
        document.visibilityState === "visible"
          ? performance.now()
          : 0;
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [index, loading, done, selected]);
  const question = items[index];
  const title =
    subjects.find((s) => s.id === subject)?.title || "Большое приключение";
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch("/.netlify/functions/quest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject,
        level: initialLevel,
        ...(week ? { week } : {}),
      }),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => {
          throw new Error("Сервер не смог передать задания. Попробуй ещё раз.");
        });
        if (!response.ok)
          throw new Error(data.error || "Не удалось загрузить задания.");
        if (!Array.isArray(data.questions) || data.questions.length !== 8)
          throw new Error("Пришёл неполный квест. Попробуй ещё раз.");
        if (!controller.signal.aborted) {
          setItems(data.questions);
          setLoading(false);
          tracking.current?.({
            type: "start",
            id: crypto.randomUUID(),
            quizId: quizId.current,
            at: new Date().toISOString(),
            subject,
            ...(week ? { week } : {}),
          });
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(
            e instanceof Error &&
              e.name !== "TimeoutError" &&
              e.name !== "TypeError"
              ? e.message
              : "Проверь подключение и попробуй снова.",
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [subject, initialLevel, requestId, week]);
  function answer(choice: number) {
    if (selected !== null) return;
    setSelected(choice);
    const correct = choice === question.answer;
    if (correct) setScore((s) => s + 1);
    const reward = onAnswer(question, correct);
    const clock = timing.current;
    const durationMs = Math.min(
      300_000,
      Math.max(
        0,
        Math.round(
          clock.elapsed + (clock.since ? performance.now() - clock.since : 0),
        ),
      ),
    );
    clock.total += durationMs;
    clock.since = 0;
    tracking.current?.({
      type: "answer",
      id: crypto.randomUUID(),
      quizId: quizId.current,
      at: new Date().toISOString(),
      subject,
      ...(week ? { week } : {}),
      question,
      answerIndex: choice,
      durationMs,
    });
    setLastEarned(reward.earned);
    setXp((v) => v + reward.earned);
    setLevelUp(reward.levelUp);
  }
  function next() {
    if (index === items.length - 1) {
      setDone(true);
      onFinish(subject, score, items.length);
      tracking.current?.({
        type: "finish",
        id: crypto.randomUUID(),
        quizId: quizId.current,
        at: new Date().toISOString(),
        subject,
        ...(week ? { week } : {}),
        durationMs: timing.current.total,
      });
    } else {
      setIndex((i) => i + 1);
      setSelected(null);
    }
  }
  function restart() {
    quizId.current = crypto.randomUUID();
    timing.current = { elapsed: 0, since: 0, total: 0 };
    setRequestId((i) => i + 1);
    setIndex(0);
    setScore(0);
    setXp(0);
    setSelected(null);
    setDone(false);
    setItems([]);
    setLoading(true);
  }
  return (
    <section className="game-page page-shell" aria-label="Одиночный квест">
      <div className="game-top">
        <button className="text-button" onClick={() => setConfirmExit(true)}>
          <X size={18} /> Выйти из квеста
        </button>
        <span className="eyebrow">
          {week ? `Неделя ${week} · ` : ""}
          {title}
        </span>
        <span className="xp-pill">
          <Star size={16} /> +{xp} XP
        </span>
      </div>
      {confirmExit && (
        <div className="inline-confirm" role="alert">
          <span>Завершить квест? Очки за ответы сохранятся.</span>
          <button className="button small" onClick={onClose}>
            Завершить
          </button>
          <button className="text-button" onClick={() => setConfirmExit(false)}>
            Продолжить
          </button>
        </div>
      )}
      {loading ? (
        <div className="loading-state" role="status">
          <LoaderCircle className="spin" /> Собираем задания для твоего уровня…
        </div>
      ) : error ? (
        <div className="waiting-card" role="alert">
          <h2>Квест пока не загрузился</h2>
          <p>{error}</p>
          <button className="button" onClick={restart}>
            Попробовать снова
          </button>
        </div>
      ) : done ? (
        <div className="result-card">
          <div className="result-art">
            <Flag size={56} />
          </div>
          <span className="eyebrow">ПРИКЛЮЧЕНИЕ ЗАВЕРШЕНО</span>
          <h1>{score >= 6 ? "Вот это открытие!" : "Ещё один шаг вперёд!"}</h1>
          <p>
            Ты ответил верно на {score} из {items.length} вопросов.
            <br />
            {score === items.length
              ? "Без единой ошибки. Настоящий мастер!"
              : "Каждая попытка помогает узнать что-то новое."}
          </p>
          <div className="result-stars">
            {[0, 1, 2].map((i) => (
              <Star
                key={i}
                size={40}
                fill={score >= [1, 4, 7][i] ? "currentColor" : "none"}
              />
            ))}
          </div>
          <strong className="result-xp">+{xp} XP в копилку знаний</strong>
          <div className="result-buttons">
            <button className="button" onClick={restart}>
              <RotateCcw size={17} /> {week ? "Повторить квест" : "Ещё квест"}
            </button>
            <button className="button secondary" onClick={onClose}>
              {week ? "К маршруту на год" : "К карте миров"}
            </button>
          </div>
        </div>
      ) : (
        question && (
          <>
            <div className="quiz-progress">
              <span>
                Задание {index + 1} из {items.length}
              </span>
              <span>
                {subjects.find((s) => s.id === question.subject)?.title}
              </span>
            </div>
            <div className="progress-track">
              <div style={{ width: `${(index / items.length) * 100}%` }} />
            </div>
            <div className="question-card" key={question.id}>
              <div className="question-tag">
                {
                  ["Разминка", "Подумай немного", "Вызов исследователю"][
                    question.difficulty - 1
                  ]
                }{" "}
                · до {[8, 12, 16][question.difficulty - 1]} XP
              </div>
              {question.passage && (
                <details className="reading-passage" open>
                  <summary>
                    <BookOpen size={17} />
                    <strong>{question.passage.title}</strong>
                    <span>Текст для чтения</span>
                  </summary>
                  <p className="reading-author">
                    {question.passage.genre} · {question.passage.author}
                  </p>
                  <div className="reading-text">{question.passage.text}</div>
                </details>
              )}
              <h1>{question.prompt}</h1>
              <div className="answer-grid">
                {question.choices.map((choice, i) => (
                  <button
                    autoFocus={i === 0 && !question.passage}
                    key={i}
                    disabled={selected !== null}
                    onClick={() => answer(i)}
                    className={`answer ${selected !== null && i === question.answer ? "correct" : ""} ${selected === i && i !== question.answer ? "incorrect" : ""}`}
                  >
                    <span className="answer-number">
                      {selected !== null && i === question.answer ? (
                        <Check size={18} />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span>{choice}</span>
                  </button>
                ))}
              </div>
              {selected !== null && (
                <div
                  className={`feedback ${selected === question.answer ? "positive" : ""}`}
                  role="status"
                >
                  <Lightbulb size={23} />
                  <div>
                    <strong>
                      {selected === question.answer
                        ? `Верно! ${lastEarned ? `+${lastEarned} XP` : "Это уже знакомое задание — повторяем без XP."}`
                        : "Разберёмся вместе"}
                    </strong>
                    <p>{question.explanation}</p>
                    {levelUp && (
                      <strong className="level-up-message">
                        ✦ Новый уровень! Отличная работа, исследователь.
                      </strong>
                    )}
                  </div>
                </div>
              )}
              <div className="question-bottom">
                <span>
                  {selected === null
                    ? "Не торопись. Здесь важнее понять, чем ответить быстро."
                    : "Ошибки — часть приключения. Главное — понять решение."}
                </span>
                {selected !== null && (
                  <button className="button" onClick={next}>
                    {index === items.length - 1 ? "Результаты" : "Дальше"}
                    <ArrowRight size={18} />
                  </button>
                )}
              </div>
            </div>
          </>
        )
      )}
    </section>
  );
}
