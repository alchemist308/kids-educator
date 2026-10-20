import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  CalendarDays,
  Compass,
  Flame,
  FlaskConical,
  Globe2,
  GraduationCap,
  Leaf,
  Map,
  Medal,
  Mountain,
  Plus,
  Sparkles,
  Sprout,
  Star,
  Swords,
  Target,
  Trophy,
  X,
} from "lucide-react";
import { subjects, questions } from "./data/questions";
import type { Question, SubjectId } from "./data/questions";
import Quiz from "./components/Quiz";
import Duel from "./components/Duel";
import YearRoute from "./components/YearRoute";
import {
  completeYearQuest,
  getAnnualAchievements,
  getAnnualProgress,
  loadYearStore,
  YEAR_STORAGE_KEY,
} from "./year-progress";
import {
  awardAnswer,
  completeQuest,
  getAchievements,
  getLevel,
  loadProgress,
  todayKey,
} from "./progress";

type View = "home" | "year" | "duel" | "achievements";
const icons = {
  math: FlaskConical,
  world: Leaf,
  russian: BookOpen,
  english: Globe2,
  literature: BookOpen,
};
const worldNames: Record<SubjectId, string> = {
  math: "Лаборатория чисел",
  world: "Заповедник открытий",
  russian: "Мастерская слова",
  english: "Остров English",
  literature: "Библиотека историй",
};
const worldDescriptions: Record<SubjectId, string> = {
  math: "Раскрой закономерности и найди красивое решение.",
  world: "Узнай, как устроены природа, человек и наша страна.",
  russian: "Подружись с правилами и поймай все ошибки.",
  english: "Собирай слова и говори с целым миром.",
  literature: "Исследуй произведения, жанры и героев.",
};

export default function App() {
  const [progress, setProgress] = useState(loadProgress);
  const [view, setView] = useState<View>("home");
  const [quiz, setQuiz] = useState<SubjectId | "mixed" | null>(null);
  const [quizWeek, setQuizWeek] = useState<number | undefined>();
  const [yearStore, setYearStore] = useState(loadYearStore);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editNames, setEditNames] = useState(
    progress.profiles.map((p) => p.name),
  );
  const [profileError, setProfileError] = useState("");
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const profileDialog = useRef<HTMLElement>(null);
  const profile = progress.profiles[progress.active];
  const yearState = yearStore.profiles[progress.active];
  const annual = getAnnualProgress(yearState);
  const today = profile.day === todayKey() ? profile.today : 0;
  const levelInfo = getLevel(profile.xp);
  const level = levelInfo.level;
  useEffect(() => {
    try {
      localStorage.setItem("questograd-progress", JSON.stringify(progress));
      setStorageUnavailable(false);
    } catch {
      setStorageUnavailable(true);
    }
  }, [progress]);
  useEffect(() => {
    try {
      localStorage.setItem(YEAR_STORAGE_KEY, JSON.stringify(yearStore));
    } catch {
      setStorageUnavailable(true);
    }
  }, [yearStore]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!profileOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    function trapFocus(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const controls = profileDialog.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input, select, [tabindex="0"]',
      );
      if (!controls?.length) return;
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", trapFocus);
    return () => {
      document.removeEventListener("keydown", trapFocus);
      previous?.focus();
    };
  }, [profileOpen]);
  function navigate(next: View) {
    setQuiz(null);
    setQuizWeek(undefined);
    setView(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function launch(subject: SubjectId | "mixed") {
    setQuizWeek(undefined);
    setQuiz(subject);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function launchYear(week: number, subject: SubjectId) {
    setQuizWeek(week);
    setQuiz(subject);
    setView("year");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  const earned = [
    ...getAchievements(profile),
    ...getAnnualAchievements(yearState),
  ];
  function updateAnswer(question: Question, correct: boolean) {
    const reward = awardAnswer(profile, question, correct);
    setProgress((p) => ({
      ...p,
      profiles: p.profiles.map((item, i) =>
        i === p.active ? reward.profile : item,
      ),
    }));
    return { earned: reward.earned, levelUp: reward.levelUp };
  }
  function finish(
    subject: SubjectId | "mixed",
    correct: number,
    total: number,
  ) {
    setProgress((p) => ({
      ...p,
      profiles: p.profiles.map((item, i) =>
        i === p.active ? completeQuest(item, subject, correct, total) : item,
      ),
    }));
    if (quizWeek && subject !== "mixed")
      setYearStore((previous) => ({
        profiles: previous.profiles.map((item, i) =>
          i === progress.active
            ? completeYearQuest(item, quizWeek, subject, correct, total)
            : item,
        ) as typeof previous.profiles,
      }));
  }
  function saveNames() {
    if (editNames.some((n) => !n.trim())) {
      setProfileError("У каждого исследователя должно быть игровое имя.");
      return;
    }
    setProgress((p) => ({
      ...p,
      profiles: p.profiles.map((item, i) => ({
        ...item,
        name: editNames[i].trim(),
      })),
    }));
    setProfileOpen(false);
  }
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={() => navigate("home")}
            aria-label="Квестоград — на главную"
          >
            <span className="brand-symbol">
              <Compass size={27} strokeWidth={1.6} />
            </span>
            <span>
              квестоград
              <span className="brand-caption">КЛУБ ЮНЫХ ИССЛЕДОВАТЕЛЕЙ</span>
            </span>
          </button>
          <nav aria-label="Основная навигация">
            <button
              className={view === "home" ? "active" : ""}
              onClick={() => navigate("home")}
            >
              <Map size={17} />
              <span className="nav-long">Приключения</span>
              <span className="nav-short">Миры</span>
            </button>
            <button
              className={view === "year" ? "active" : ""}
              onClick={() => navigate("year")}
              aria-label="Маршрут на год"
            >
              <CalendarDays size={17} />
              <span className="nav-long">Маршрут на год</span>
              <span className="nav-short">Мой год</span>
            </button>
            <button
              className={view === "duel" ? "active" : ""}
              onClick={() => navigate("duel")}
            >
              <Swords size={17} />
              <span className="nav-long">Дуэль с другом</span>
              <span className="nav-short">Дуэль</span>
              <span className="nav-dot" />
            </button>
            <button
              className={view === "achievements" ? "active" : ""}
              onClick={() => navigate("achievements")}
            >
              <Medal size={17} />
              <span className="nav-long">Достижения</span>
              <span className="nav-short">Значки</span>
            </button>
          </nav>
          <button
            className="profile-button"
            onClick={() => {
              setEditNames(progress.profiles.map((p) => p.name));
              setProfileError("");
              setProfileOpen(true);
            }}
            disabled={quiz !== null}
          >
            <span className={`avatar avatar-${progress.active}`}>
              {progress.active === 0 ? "🦊" : "🐻"}
            </span>
            <span>
              {profile.name}
              <small>Уровень {level} · исследователь</small>
            </span>
            <ChevronDown size={15} />
          </button>
        </div>
      </header>
      {storageUnavailable && (
        <p className="storage-notice" role="status">
          Браузер не разрешает сохранять прогресс. Можно играть, но достижения
          исчезнут после закрытия страницы.
        </p>
      )}
      {quiz ? (
        <Quiz
          key={`${quiz}-${quizWeek ?? "free"}`}
          subject={quiz}
          level={level}
          week={quizWeek}
          onClose={() => setQuiz(null)}
          onAnswer={updateAnswer}
          onFinish={finish}
        />
      ) : view === "year" ? (
        <YearRoute
          key={progress.active}
          state={yearState}
          name={profile.name}
          onStart={launchYear}
        />
      ) : view === "duel" ? (
        <Duel
          name={profile.name}
          level={level}
          onHome={() => navigate("home")}
        />
      ) : view === "achievements" ? (
        <main className="page-shell achievements-page">
          <div className="section-intro">
            <span className="eyebrow">ТВОЯ ИСТОРИЯ ОТКРЫТИЙ</span>
            <h1>Маленькие шаги. Большие победы.</h1>
            <p>
              Здесь живут достижения {profile.name}. Каждый квест приближает к
              новому.
            </p>
          </div>
          <div className="achievement-summary">
            <div className="round-icon orange">
              <Trophy size={30} />
            </div>
            <div>
              <strong>
                {earned.filter((a) => a.earned).length} из {earned.length}{" "}
                значков открыто
              </strong>
              <p>
                {profile.correct} верных ответов · {profile.games} завершённых
                квестов · {profile.xp} XP
              </p>
            </div>
          </div>
          <div className="level-overview">
            <div>
              <span className="eyebrow">ТВОЙ УРОВЕНЬ</span>
              <h2>
                {level} ·{" "}
                {level < 10
                  ? "Начинающий исследователь"
                  : level < 25
                    ? "Опытный следопыт"
                    : "Мастер открытий"}
              </h2>
              <p>
                {levelInfo.current} из {levelInfo.required} XP до уровня{" "}
                {level + 1}
              </p>
              <div className="progress-track">
                <div style={{ width: `${levelInfo.progress * 100}%` }} />
              </div>
            </div>
            <div className="level-rules">
              <strong>Растём без спешки</strong>
              <p>
                Новый верный ответ: 8 / 12 / 16 XP по сложности. Повтор уже
                решённого задания — тренировка без XP. На следующий уровень
                нужно на 25 XP больше: 100, 125, 150… Ошибки не отнимают опыт.
              </p>
            </div>
          </div>
          <div className="achievement-grid">
            {earned.map((badge) => {
              const Icon = badge.subject ? icons[badge.subject] : Trophy;
              return (
                <div
                  className={`achievement-card ${badge.earned ? "earned" : ""}`}
                  key={badge.id}
                >
                  <div className="badge-icon">
                    <Icon size={34} />
                  </div>
                  <span className="achievement-status">
                    {badge.earned ? "Открыто ✓" : "Впереди"}
                  </span>
                  <h2>{badge.title}</h2>
                  <p>{badge.description}</p>
                  <div className="badge-progress">
                    <span>
                      {Math.min(badge.progress, badge.target)} / {badge.target}
                    </span>
                    <div className="mini-progress">
                      <div
                        style={{
                          width: `${Math.min(badge.progress / badge.target, 1) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="privacy-note">
            Достижения за одиночные квесты хранятся только в этом браузере,
            отдельно для каждого игрока. Очки сетевой дуэли считаются внутри
            комнаты.
          </p>
          <button className="button" onClick={() => navigate("home")}>
            Навстречу открытиям <ArrowRight size={17} />
          </button>
        </main>
      ) : (
        <main className="page-shell">
          <section className="hero">
            <div className="hero-copy">
              <div className="hero-eyebrow">
                <span className="live-dot" /> НЕ ПРОСТО УЧЁБА. ПРИКЛЮЧЕНИЕ.
              </div>
              <h1>
                Мир большой.
                <br />
                Начни с <em>открытия.</em>
              </h1>
              <p>
                Решай, исследуй, удивляйся. Пять миров знаний
                <br className="desktop-break" /> и маленькие победы, которые
                делают тебя сильнее.
              </p>
              <div className="hero-actions">
                <button className="button" onClick={() => navigate("year")}>
                  Начать приключение <ArrowRight size={18} />
                </button>
                <button
                  className="text-button free-practice-link"
                  onClick={() => launch("mixed")}
                >
                  Быстрая тренировка
                </button>
                <span className="hero-duration">
                  <Compass size={17} /> 8 заданий · 10–15 минут
                </span>
              </div>
              <div className="hero-footnote">
                <span className="tiny-avatars">
                  <span>🦊</span>
                  <span>🐻</span>
                </span>
                Одному интересно. Вместе — ещё лучше.
              </div>
            </div>
            <div className="hero-art">
              <img
                src="/adventure.svg"
                alt="Остров знаний: уютный городок среди гор и деревьев, книга, кристаллы и компас"
              />
              <div className="art-label">
                <span>✦</span> Здесь начинается твоё приключение
              </div>
              <span className="art-coordinate">55° С. Ш. · 37° В. Д.</span>
            </div>
          </section>
          <section className="annual-dashboard">
            <div className="round-icon green">
              <CalendarDays size={27} />
            </div>
            <div>
              <span className="eyebrow">ГОДОВОЙ МАРШРУТ · 52 НЕДЕЛИ</span>
              <h2>
                {annual.yearFinished
                  ? "Год открытий завершён!"
                  : `Неделя ${annual.week}: маленькие шаги к большому`}
              </h2>
              <p>
                {annual.completed} из 260 квестов · 5 занятий в неделю по 10–15
                минут · 2 080 заданий с повторением
              </p>
            </div>
            <button className="button" onClick={() => navigate("year")}>
              Мой маршрут
              <ArrowRight size={17} />
            </button>
          </section>
          <section className="progress-strip" aria-label="Твой прогресс">
            <div className="progress-greeting">
              <div className="round-icon pale">
                <Sprout size={25} />
              </div>
              <div>
                <strong>Рад тебя видеть, {profile.name}!</strong>
                <span>Какое открытие сделаем сегодня?</span>
              </div>
            </div>
            <div className="stat-item">
              <span className="stat-icon gold">
                <Star size={23} />
              </span>
              <div>
                <strong>
                  {profile.xp} <small>XP</small>
                </strong>
                <span>
                  Уровень {level} · ещё {levelInfo.required - levelInfo.current}{" "}
                  XP
                </span>
                <div className="mini-progress level-mini">
                  <div style={{ width: `${levelInfo.progress * 100}%` }} />
                </div>
              </div>
            </div>
            <div className="stat-item daily-stat">
              <span className="stat-icon coral">
                <Flame size={23} />
              </span>
              <div>
                <strong>
                  {Math.min(today, 8)} <small>/ 8 заданий</small>
                </strong>
                <span>Цель на сегодня</span>
                <div className="mini-progress">
                  <div
                    style={{ width: `${Math.min((today / 8) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
            <button
              className="stat-item medal-stat"
              onClick={() => navigate("achievements")}
            >
              <span className="stat-icon sage">
                <Medal size={24} />
              </span>
              <div>
                <strong>
                  {earned.filter((a) => a.earned).length} <small>значков</small>
                </strong>
                <span>
                  Твои достижения <ArrowRight size={12} />
                </span>
              </div>
            </button>
          </section>
          <section className="worlds-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">КАРТА ПРИКЛЮЧЕНИЙ</span>
                <h2>Куда отправимся?</h2>
              </div>
              <span className="grade-badge">
                <GraduationCap size={16} /> 4 класс <span>·</span> От простого к
                сложному
              </span>
            </div>
            <div className="subject-grid">
              {subjects.map((s, i) => {
                const Icon = icons[s.id];
                const solved = profile.subjects[s.id] || 0;
                return (
                  <button
                    className={`subject-card subject-${s.id}`}
                    onClick={() => launch(s.id)}
                    key={s.id}
                  >
                    <div className="subject-illustration">
                      <span className="subject-orbit orbit-one" />
                      <span className="subject-orbit orbit-two" />
                      <div className="subject-icon">
                        <Icon size={38} strokeWidth={1.5} />
                      </div>
                      <span className="subject-decoration">
                        {["×", "✦", "а", "hi!", "✧"][i]}
                      </span>
                      <span className="world-number">0{i + 1}</span>
                    </div>
                    <div className="subject-content">
                      <span className="subject-label">{s.title}</span>
                      <h3>{worldNames[s.id]}</h3>
                      <p>{worldDescriptions[s.id]}</p>
                      <div className="subject-meta">
                        <span>
                          {solved > 0
                            ? `${solved} верных ответов`
                            : `${questions.filter((q) => q.subject === s.id).length} ${s.id === "literature" ? "авторских заданий" : "базовых + варианты"}`}
                        </span>
                        <span className="subject-arrow">
                          <ArrowRight size={17} />
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="curriculum-note">
              <BookOpen size={15} />
              <span>
                Математика — с опорой на программу Петерсон. Русский язык,
                окружающий мир и литература — по темам «Школы России».
              </span>
            </div>
          </section>
          <section className="duel-banner">
            <div className="duel-banner-art">
              <Swords size={48} strokeWidth={1.4} />
              <span className="duel-spark">✦</span>
            </div>
            <div className="duel-banner-copy">
              <span className="eyebrow">ВДВОЁМ ВЕСЕЛЕЕ</span>
              <h2>
                Знания — твоя суперсила.
                <br />
                Проверим в дружеской дуэли?
              </h2>
              <p>
                Позови брата или друга. Одинаковые задания, честный счёт
                <br className="desktop-break" /> и радость открытия на двоих.
              </p>
            </div>
            <div className="duel-banner-action">
              <button className="button light" onClick={() => navigate("duel")}>
                Играть с другом <ArrowRight size={17} />
              </button>
              <span>
                <span className="live-dot" /> С разных устройств · по коду
                комнаты
              </span>
            </div>
          </section>
          <section className="how-section">
            <div>
              <div className="step-number">01</div>
              <h3>Выбирай свой мир</h3>
              <p>
                Пять предметов, десятки открытий.
                <br />
                Каждый найдёт что-то по душе.
              </p>
            </div>
            <div>
              <div className="step-number">02</div>
              <h3>Думай и пробуй</h3>
              <p>
                Ошибаться можно. Объяснения
                <br />
                помогут во всём разобраться.
              </p>
            </div>
            <div>
              <div className="step-number">03</div>
              <h3>Замечай свой рост</h3>
              <p>
                Копи опыт, открывай значки
                <br />и радуйся маленьким победам.
              </p>
            </div>
            <div className="handwritten">
              <Sparkles size={22} />
              <span>
                Любопытство —<br />
                лучшее начало!
              </span>
            </div>
          </section>
        </main>
      )}
      <footer className="site-footer">
        <div className="footer-inner">
          <span>
            <Compass size={18} /> квестоград{" "}
            <span className="footer-dot">·</span> Учиться приключаясь
          </span>
          <span>С заботой о любопытстве. Для 4 класса.</span>
        </div>
        <p>
          Авторские задания для дополнительной практики. Английский — базовые
          темы 4 класса. Без рекламы и регистрации.
        </p>
      </footer>
      {profileOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setProfileOpen(false);
          }}
        >
          <section
            ref={profileDialog}
            className="profile-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-title"
          >
            <button
              className="modal-close"
              onClick={() => setProfileOpen(false)}
              aria-label="Закрыть"
            >
              <X size={21} />
            </button>
            <span className="eyebrow">КОМАНДА ИССЛЕДОВАТЕЛЕЙ</span>
            <h2 id="profile-title">Кто сегодня играет?</h2>
            <p>
              У каждого — своё имя и свои открытия.
              <br />
              Прогресс сохраняется в этом браузере.
            </p>
            {progress.profiles.map((p, i) => (
              <div
                className={`profile-option ${progress.active === i ? "chosen" : ""}`}
                key={i}
              >
                <button
                  onClick={() =>
                    setProgress((previous) => ({ ...previous, active: i }))
                  }
                  aria-label={`Выбрать ${p.name}`}
                >
                  <span className={`avatar avatar-${i}`}>
                    {i === 0 ? "🦊" : "🐻"}
                  </span>
                  {progress.active === i ? (
                    <Check size={19} />
                  ) : (
                    <Plus size={17} />
                  )}
                </button>
                <label>
                  <span>Исследователь {i + 1}</span>
                  <input
                    autoFocus={i === 0}
                    aria-label={`Имя игрока ${i + 1}`}
                    maxLength={20}
                    value={editNames[i]}
                    onChange={(e) =>
                      setEditNames((names) =>
                        names.map((n, j) => (j === i ? e.target.value : n)),
                      )
                    }
                  />
                </label>
                <strong>
                  {p.xp} <small>XP</small>
                </strong>
              </div>
            ))}
            {profileError && (
              <p className="form-error" role="alert">
                {profileError}
              </p>
            )}
            <button className="button full" onClick={saveNames}>
              Вперёд, к открытиям <ArrowRight size={17} />
            </button>
            <small className="profile-privacy">
              Лучше использовать игровые имена. Личные данные не нужны.
            </small>
          </section>
        </div>
      )}
    </>
  );
}
