import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  Copy,
  DoorOpen,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import { subjects } from "../data/questions";
import type { SubjectId } from "../data/questions";
import type {
  DuelFeedback,
  DuelRequest,
  DuelResponse,
  DuelRoom,
} from "../../server/contract";

type Session = { code: string; token: string };
const sessionKey = "questograd-duel-session";
function loadSession(): Session | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(sessionKey) || "null");
    return s && typeof s.code === "string" && typeof s.token === "string"
      ? s
      : null;
  } catch {
    return null;
  }
}
async function api(body: DuelRequest): Promise<DuelResponse> {
  const response = await fetch("/.netlify/functions/duel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : "Не удалось связаться с комнатой. Попробуй ещё раз.",
    );
  return data;
}

export default function Duel({
  name,
  level,
  onHome,
}: {
  name: string;
  level: number;
  onHome: () => void;
}) {
  const [session, setSession] = useState<Session | null>(loadSession);
  const [room, setRoom] = useState<DuelRoom | null>(null);
  const [code, setCode] = useState("");
  const [playerName, setPlayerName] = useState(name);
  const [subject, setSubject] = useState<SubjectId | "mixed">("mixed");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<DuelFeedback | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    try {
      if (session) sessionStorage.setItem(sessionKey, JSON.stringify(session));
      else sessionStorage.removeItem(sessionKey);
    } catch {
      /* Storage can be disabled. */
    }
    if (!session) return;
    let alive = true;
    let timeout: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const data = await api({ action: "status", ...session });
        if (alive) {
          setRoom((current) =>
            current &&
            current.code === data.room.code &&
            current.revision > data.room.revision
              ? current
              : data.room,
          );
          setError("");
        }
      } catch (e) {
        if (alive)
          setError(
            e instanceof Error
              ? e.message
              : "Связь прервалась. Проверяем подключение…",
          );
      }
      if (alive) timeout = setTimeout(poll, 1800);
    };
    void poll();
    return () => {
      alive = false;
      clearTimeout(timeout);
    };
  }, [session]);
  async function connect(action: "create" | "join") {
    if (!playerName.trim()) {
      setError("Введи игровое имя. Настоящую фамилию указывать не нужно.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api(
        action === "create"
          ? { action, name: playerName.trim(), subject, level }
          : {
              action,
              code: code.trim().toUpperCase(),
              name: playerName.trim(),
            },
      );
      if (mounted.current && result.token) {
        setRoom(result.room);
        setSession({ code: result.room.code, token: result.token });
      }
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error ? e.message : "Не удалось открыть комнату.",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function answer(answerIndex: number) {
    if (!room?.currentQuestion || !session || busy || feedback) return;
    setBusy(true);
    setError("");
    setChosen(answerIndex);
    try {
      const data = await api({
        action: "answer",
        ...session,
        questionId: room.currentQuestion.id,
        answerIndex,
      });
      if (mounted.current) {
        setRoom((current) =>
          current &&
          current.code === data.room.code &&
          current.revision > data.room.revision
            ? current
            : data.room,
        );
        setFeedback(data.room.feedback);
      }
    } catch (e) {
      if (mounted.current) {
        setError(
          e instanceof Error
            ? e.message
            : "Ответ не отправлен. Повтори попытку.",
        );
        setChosen(null);
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  function leave() {
    setSession(null);
    setRoom(null);
    setFeedback(null);
    setChosen(null);
    setError("");
  }
  const self = room?.players.find((p) => p.id === room.selfId);
  const won = room?.winnerIds.includes(room.selfId);
  return (
    <section className="page-shell duel-page">
      <button className="text-button" onClick={onHome}>
        <ArrowLeft size={17} /> К карте миров
      </button>
      <div className="section-intro">
        <span className="eyebrow">ВМЕСТЕ ИНТЕРЕСНЕЕ</span>
        <h1>Дружеская дуэль</h1>
        <p>Один код. Два исследователя. Восемь вопросов на пути к победе.</p>
      </div>
      {error && (
        <div className="error-message" role="alert">
          {error}
          {session && (
            <button className="text-button" onClick={leave}>
              В другую комнату
            </button>
          )}
        </div>
      )}
      {!session ? (
        <>
          <div className="duel-name">
            <label htmlFor="duel-name">Твоё игровое имя</label>
            <input
              id="duel-name"
              value={playerName}
              maxLength={20}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Например, Следопыт"
            />
            <span>Без фамилии, почты и регистрации</span>
          </div>
          <div className="duel-entry-grid">
            <div className="entry-card">
              <div className="round-icon green">
                <Swords size={29} />
              </div>
              <h2>Позвать соперника</h2>
              <p>
                Создай комнату и передай код брату или другу. Он сможет зайти с
                другого устройства.
              </p>
              <label htmlFor="duel-subject">Выбери мир</label>
              <select
                id="duel-subject"
                value={subject}
                onChange={(e) =>
                  setSubject(e.target.value as SubjectId | "mixed")
                }
              >
                <option value="mixed">Все пять миров</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
              <button
                className="button full"
                disabled={busy}
                onClick={() => connect("create")}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <Swords size={18} />
                )}{" "}
                Создать комнату
              </button>
            </div>
            <div className="entry-card">
              <div className="round-icon orange">
                <DoorOpen size={29} />
              </div>
              <h2>Принять вызов</h2>
              <p>
                Тебя уже ждут? Введи шестизначный код комнаты и присоединяйся к
                игре.
              </p>
              <label htmlFor="room-code">Код комнаты</label>
              <input
                id="room-code"
                autoComplete="off"
                maxLength={6}
                value={code}
                onChange={(e) =>
                  setCode(
                    e.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase(),
                  )
                }
                placeholder="ABC123"
                className="code-input"
              />
              <button
                className="button secondary full"
                disabled={busy || code.length !== 6}
                onClick={() => connect("join")}
              >
                Присоединиться <ArrowRight size={18} />
              </button>
            </div>
          </div>
          <div className="duel-rules">
            <ShieldCheck size={21} />
            <p>
              У обоих одинаковые задания. За верный ответ — 10 очков, штрафов за
              ошибку нет. Скорость не влияет на результат: думай спокойно.
              Комната доступна 2 часа.
            </p>
          </div>
        </>
      ) : !room ? (
        <div className="loading-state">
          <LoaderCircle className="spin" /> Восстанавливаем комнату…
        </div>
      ) : (
        <>
          <div className="duel-room-header">
            <span>
              Комната <strong>{room.code}</strong>
            </span>
            <button className="text-button" onClick={leave}>
              Выйти из комнаты
            </button>
          </div>
          <div className="players-bar">
            {[0, 1].map((i) => {
              const player = room.players[i];
              return (
                <div
                  className={`player-score ${player?.id === room.selfId ? "is-self" : ""}`}
                  key={i}
                >
                  <span className={`avatar avatar-${i}`}>
                    {i === 0 ? "🦊" : "🐻"}
                  </span>
                  <div>
                    <strong>{player?.name || "Ждём соперника"}</strong>
                    <small>
                      {player
                        ? `${player.answered} из ${room.total} заданий${player.id === room.selfId ? " · это ты" : ""}`
                        : "Отправь другу код комнаты"}
                    </small>
                  </div>
                  <b>
                    {player?.score ?? "—"} <small>очков</small>
                  </b>
                </div>
              );
            })}
          </div>
          {room.state === "waiting" ? (
            <div className="waiting-card">
              <div className="round-icon green">
                <Users size={36} />
              </div>
              <h2>Комната открыта!</h2>
              <p>
                Передай этот код второму игроку.
                <br />
                Дуэль начнётся, когда он присоединится.
              </p>
              <div className="large-code">{room.code}</div>
              <button
                className="button secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(room.code);
                    setCopied(true);
                  } catch {
                    setError("Скопируй код комнаты вручную.");
                  }
                }}
              >
                {copied ? <CheckCheck size={17} /> : <Copy size={17} />}
                {copied ? "Код скопирован" : "Скопировать код"}
              </button>
              <div className="waiting-note">
                <span className="live-dot" /> Ждём второго исследователя
              </div>
            </div>
          ) : feedback ? (
            <div className="question-card duel-feedback" role="status">
              <div
                className={`round-icon ${feedback.correct ? "green" : "orange"}`}
              >
                {feedback.correct ? (
                  <Check size={32} />
                ) : (
                  <RefreshCw size={30} />
                )}
              </div>
              <h2>
                {feedback.correct
                  ? "Верно! +10 очков"
                  : "Есть кое-что интересное"}
              </h2>
              <p>{feedback.explanation}</p>
              <button
                className="button"
                onClick={() => {
                  setFeedback(null);
                  setChosen(null);
                }}
              >
                Продолжить <ArrowRight size={17} />
              </button>
            </div>
          ) : room.state === "finished" ? (
            <div className="result-card">
              <div className="result-art">
                <Trophy size={54} />
              </div>
              <span className="eyebrow">ДУЭЛЬ ЗАВЕРШЕНА</span>
              <h1>
                {room.winnerIds.length > 1
                  ? "Дружеская ничья!"
                  : won
                    ? "Ты победил!"
                    : "Отличная игра!"}
              </h1>
              <p>
                {room.winnerIds.length > 1
                  ? "Вы оказались одинаково сильны. Достойные соперники!"
                  : `Победитель — ${room.players.find((p) => room.winnerIds.includes(p.id))?.name}. Сыграйте ещё: новый квест — новый шанс!`}
              </p>
              <strong className="result-xp">
                Твой результат: {self?.score} очков
              </strong>
              <button className="button" onClick={leave}>
                Новая дуэль <ArrowRight size={17} />
              </button>
            </div>
          ) : !room.currentQuestion ? (
            <div className="waiting-card">
              <CheckCheck size={44} />
              <h2>Твоя часть квеста пройдена!</h2>
              <p>Соперник ещё думает. Дождёмся его и узнаем результат.</p>
              <span className="waiting-note">
                <span className="live-dot" /> Результат обновится автоматически
              </span>
            </div>
          ) : (
            <>
              <div className="quiz-progress">
                <span>
                  Твоё задание {(self?.answered || 0) + 1} из {room.total}
                </span>
                <span>
                  {
                    subjects.find((s) => s.id === room.currentQuestion?.subject)
                      ?.title
                  }
                </span>
              </div>
              <div className="progress-track">
                <div
                  style={{
                    width: `${((self?.answered || 0) / room.total) * 100}%`,
                  }}
                />
              </div>
              <div className="question-card">
                <span className="question-tag">
                  Сначала подумай, потом отвечай
                </span>
                {room.currentQuestion.passage && (
                  <details className="reading-passage" open>
                    <summary>
                      <BookOpen size={17} />
                      <strong>{room.currentQuestion.passage.title}</strong>
                      <span>Текст для чтения</span>
                    </summary>
                    <p className="reading-author">
                      {room.currentQuestion.passage.genre} ·{" "}
                      {room.currentQuestion.passage.author}
                    </p>
                    <div className="reading-text">
                      {room.currentQuestion.passage.text}
                    </div>
                  </details>
                )}
                <h2>{room.currentQuestion.prompt}</h2>
                <div className="answer-grid">
                  {room.currentQuestion.choices.map((choice, i) => (
                    <button
                      key={`${room.currentQuestion?.id}-${i}`}
                      className={`answer ${chosen === i ? "selected" : ""}`}
                      disabled={busy}
                      onClick={() => answer(i)}
                    >
                      <span className="answer-number">{i + 1}</span>
                      <span>{choice}</span>
                    </button>
                  ))}
                </div>
                {busy && <p className="muted">Отправляем ответ…</p>}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
