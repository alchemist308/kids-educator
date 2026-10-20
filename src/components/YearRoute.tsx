import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Compass,
  Flag,
  Star,
} from "lucide-react";
import { useState } from "react";
import { getWeekPlan, yearPlan } from "../data/curriculum";
import { subjects } from "../data/questions";
import type { SubjectId } from "../data/questions";
import { getAnnualProgress, yearQuestKey } from "../year-progress";
import type { YearProgress } from "../year-progress";

const chapters = [
  "Разведка знаний",
  "Уверенная практика",
  "Связываем открытия",
  "Мастерская исследователя",
];
export default function YearRoute({
  state,
  name,
  onStart,
}: {
  state: YearProgress;
  name: string;
  onStart: (week: number, subject: SubjectId) => void;
}) {
  const progress = getAnnualProgress(state);
  const [selectedWeek, setSelectedWeek] = useState(progress.week);
  const plan = getWeekPlan(selectedWeek);
  const chapter = Math.floor((selectedWeek - 1) / 13);
  const doneThisWeek = subjects.filter(
    (s) => state.quests[yearQuestKey(selectedWeek, s.id)],
  ).length;
  return (
    <main className="page-shell year-page">
      <div className="year-intro">
        <div>
          <span className="eyebrow">52 НЕДЕЛИ · 5 МИРОВ · ТВОЙ ТЕМП</span>
          <h1>
            Большое путешествие
            <br />
            длиной в год.
          </h1>
          <p>
            {name}, каждый день — одно небольшое открытие.
            <br />
            Пять квестов в неделю, повторение и время всё осмыслить.
          </p>
        </div>
        <div className="year-emblem">
          <CalendarDays size={57} strokeWidth={1.3} />
          <span>52</span>
          <small>НЕДЕЛИ ОТКРЫТИЙ</small>
        </div>
      </div>
      <section className="year-summary" aria-label="Прогресс годового маршрута">
        <div>
          <span className="eyebrow">ПРОЙДЕНО ЗА ГОД</span>
          <strong>
            {progress.completed} <small>из 260 квестов</small>
          </strong>
          <div className="progress-track">
            <div style={{ width: `${progress.progress * 100}%` }} />
          </div>
        </div>
        <div>
          <CalendarDays size={22} />
          <strong>5 дней в неделю</strong>
          <span>По 10–15 минут, выходные — отдых</span>
        </div>
        <div>
          <BookOpen size={22} />
          <strong>2 080 заданий</strong>
          <span>Новые варианты и полезное повторение</span>
        </div>
      </section>
      {progress.yearFinished && (
        <div className="year-complete" role="status">
          <Flag size={27} />
          <div>
            <strong>Годовой маршрут пройден!</strong>
            <p>
              260 квестов позади. Можно повторять любимые темы и открывать новые
              варианты в свободной практике.
            </p>
          </div>
        </div>
      )}
      <div className="year-chapters" aria-label="Этапы годового маршрута">
        {chapters.map((title, i) => (
          <button
            className={i === chapter ? "selected" : ""}
            key={title}
            onClick={() => setSelectedWeek(i * 13 + 1)}
          >
            <span>
              0{i + 1} · недели {i * 13 + 1}–{(i + 1) * 13}
            </span>
            <strong>{title}</strong>
          </button>
        ))}
      </div>
      <div className="year-weeks" aria-label="Недели маршрута">
        {yearPlan.slice(chapter * 13, chapter * 13 + 13).map((week) => {
          const complete = subjects.every(
            (s) => state.quests[yearQuestKey(week.week, s.id)],
          );
          return (
            <button
              key={week.week}
              aria-label={`Неделя ${week.week}${complete ? " — пройдена" : ""}`}
              aria-pressed={selectedWeek === week.week}
              className={`${selectedWeek === week.week ? "selected" : ""} ${complete ? "complete" : ""} ${week.checkpoint ? "checkpoint" : ""}`}
              onClick={() => setSelectedWeek(week.week)}
            >
              {complete ? <Check size={17} /> : week.week}
              {week.checkpoint && <span>✦</span>}
            </button>
          );
        })}
      </div>
      <section className="week-plan">
        <div className="week-heading">
          <div>
            <span className="eyebrow">
              НЕДЕЛЯ {selectedWeek} ИЗ 52{" "}
              {plan.checkpoint
                ? "· КОНТРОЛЬНАЯ ЭКСПЕДИЦИЯ"
                : plan.review
                  ? "· ЗАКРЕПЛЯЕМ ЗНАНИЯ"
                  : ""}
            </span>
            <h2>{plan.title}</h2>
            <p>
              {doneThisWeek} из 5 квестов пройдено · каждый предмет встречается
              раз в неделю
            </p>
          </div>
          <span className="week-stamp">
            {plan.checkpoint ? <Flag size={30} /> : <Compass size={30} />}
          </span>
        </div>
        <div className="week-quests">
          {subjects.map((s, i) => {
            const topic = plan.subjects[s.id];
            const completed = state.quests[yearQuestKey(selectedWeek, s.id)];
            return (
              <article
                className={`week-quest subject-${s.id} ${completed ? "complete" : ""}`}
                key={s.id}
              >
                <div className="week-quest-day">
                  {completed ? (
                    <CheckCheck size={20} />
                  ) : (
                    <span>{["ПН", "ВТ", "СР", "ЧТ", "ПТ"][i]}</span>
                  )}
                </div>
                <div className="week-quest-copy">
                  <span>{s.title}</span>
                  <h3>{topic.title}</h3>
                  <p>{topic.skills.join(" · ")}</p>
                  {completed && (
                    <small>Лучший результат: {completed.correct} из 8</small>
                  )}
                </div>
                <button
                  className={`button ${completed ? "secondary" : ""}`}
                  onClick={() => onStart(selectedWeek, s.id)}
                >
                  {completed ? "Повторить" : "Начать квест"}
                  <ArrowRight size={16} />
                </button>
              </article>
            );
          })}
        </div>
        <div className="week-navigation">
          <button
            className="text-button"
            disabled={selectedWeek === 1}
            onClick={() => setSelectedWeek((n) => n - 1)}
          >
            <ChevronLeft size={17} />
            Прошлая неделя
          </button>
          <button
            className="text-button"
            onClick={() => setSelectedWeek(progress.week)}
          >
            <Star size={15} />
            Моя неделя: {progress.week}
          </button>
          <button
            className="text-button"
            disabled={selectedWeek === 52}
            onClick={() => setSelectedWeek((n) => n + 1)}
          >
            Следующая неделя
            <ChevronRight size={17} />
          </button>
        </div>
      </section>
      <div className="year-pacing">
        <CalendarDays size={22} />
        <div>
          <strong>Растём в своём темпе</strong>
          <p>
            Рекомендуем один квест в учебный день. Можно идти в своём темпе и
            возвращаться к пройденному. Каждая четвёртая неделя закрепляет
            знания, а недели 13, 26, 39 и 52 проверяют изученные темы. За уже
            решённые варианты опыт повторно не начисляется.
          </p>
        </div>
      </div>
    </main>
  );
}
