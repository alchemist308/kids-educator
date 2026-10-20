import { useState } from "react";
import { Cloud, CloudOff, Link, LoaderCircle, ShieldCheck } from "lucide-react";
import type { FamilySyncClient } from "../family-client";

export default function FamilyConnect({
  client,
  onParent,
}: {
  client: FamilySyncClient;
  onParent?: () => void;
}) {
  const [code, setCode] = useState("");
  const [deviceName, setDeviceName] = useState("Детский компьютер");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  async function connect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await client.pair(code, deviceName);
      setCode("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось подключить устройство.",
      );
    } finally {
      setBusy(false);
    }
  }
  function disconnect(force = false) {
    try {
      client.disconnect(force);
      setConfirmDisconnect(false);
      setError("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось отключить устройство.",
      );
      setConfirmDisconnect(true);
    }
  }
  return (
    <section className="family-connect" aria-label="Семейная синхронизация">
      <div className="family-connect-heading">
        {client.connected ? <Cloud size={21} /> : <ShieldCheck size={21} />}
        <h3>
          {client.connected ? "Подключено к семье" : "Прогресс для родителя"}
        </h3>
      </div>
      {client.connected ? (
        <>
          <p>
            {client.deviceName}. Оба профиля сохраняются в облаке. Пароль
            родителя здесь не нужен.
          </p>
          <p className="family-sync-status" role="status">
            {client.status === "syncing" ? (
              <LoaderCircle size={15} className="spin" />
            ) : client.status === "synced" ? (
              <Cloud size={15} />
            ) : (
              <CloudOff size={15} />
            )}
            {client.pending
              ? `В очереди: ${client.pending}`
              : client.status === "synced"
                ? "Весь прогресс передан"
                : "Ожидаем синхронизации"}
          </p>
          {client.error && (
            <p className="form-error" role="alert">
              {client.error}
            </p>
          )}
          <div className="family-connect-actions">
            <button
              type="button"
              className="text-button"
              disabled={busy || client.status === "syncing"}
              onClick={() => {
                void client.flush();
              }}
            >
              Синхронизировать
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => disconnect()}
            >
              Отключить устройство
            </button>
          </div>
          {confirmDisconnect && (
            <div className="inline-confirm">
              <p>
                Непереданная подробная история не попадёт к родителю. Общий
                прогресс останется в этом браузере.
              </p>
              <button
                type="button"
                className="text-button"
                onClick={() => disconnect(true)}
              >
                Всё равно отключить
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setConfirmDisconnect(false);
                  setError("");
                }}
              >
                Отмена
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <p>
            Введите одноразовый код из кабинета родителя. Уже накопленные уровни
            и достижения сохранятся.
          </p>
          <form onSubmit={connect} className="family-connect-form">
            <label>
              <span>Название устройства</span>
              <input
                value={deviceName}
                onChange={(event) => setDeviceName(event.target.value)}
                maxLength={40}
                autoComplete="off"
                required
              />
            </label>
            <label>
              <span>Код подключения</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="Код из кабинета"
                maxLength={16}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                required
              />
            </label>
            <button
              type="submit"
              className="button secondary full"
              disabled={busy || !code.trim()}
            >
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Link size={16} />
              )}{" "}
              Подключить к семье
            </button>
          </form>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
      {client.connected && error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {onParent && (
        <button
          type="button"
          className="text-button family-parent-link"
          onClick={onParent}
        >
          <ShieldCheck size={16} /> Кабинет родителя
        </button>
      )}
    </section>
  );
}
