import { action, computed, makeObservable, observable } from "mobx";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import playPng from "./play.png";
import pausePng from "./pause.png";
import { generateNanoid } from "./utils";

function formatDuration(durationSeconds: number) {
  let rv = "";
  if (durationSeconds > 60 * 60) {
    rv += `${Math.floor(durationSeconds / (60 * 60))}:`;
  }
  rv += `${`${Math.floor((durationSeconds % 3600) / 60)}`.padStart(2, "0")}:`;
  rv += `${Math.floor(durationSeconds % 60)}`.padStart(2, "0");
  return rv;
}

type TimerState = {
  runningEndTime: number | undefined;
  pausedSecondsRemaining: number | undefined;
};

const Timer = observer(
  ({
    durationSeconds,
    state,
  }: {
    durationSeconds: number;
    state: TimerState;
  }) => {
    const [secondsRemainingBox] = useState(() =>
      observable.box<number | undefined>(undefined)
    );
    useEffect(() => {
      const runningEndTime = state.runningEndTime;
      if (runningEndTime !== undefined) {
        const tick = action(() => {
          const secondsRemaining = Math.round(
            (runningEndTime - Date.now()) / 1000
          );
          secondsRemainingBox.set(secondsRemaining);
        });
        tick();
        const interval = setInterval(tick, 100);
        return () => {
          clearInterval(interval);
        };
      }
    }, [state.runningEndTime]);
    const secondsRemaining = secondsRemainingBox.get();

    return (
      <div className="inline-flex items-center gap-1">
        {state.runningEndTime === undefined ? (
          <button
            onClick={action(() => {
              state.runningEndTime =
                Date.now() +
                (state.pausedSecondsRemaining ?? durationSeconds) * 1000;
              state.pausedSecondsRemaining = undefined;
            })}
            className="flex-shrink-0"
          >
            <img src={playPng} width="11px" height="11px" />
          </button>
        ) : (
          <button
            onClick={action(() => {
              state.pausedSecondsRemaining = secondsRemaining;
              state.runningEndTime = undefined;
            })}
            className="flex-shrink-0"
          >
            <img src={pausePng} width="11px" height="11px" />
          </button>
        )}
        <span className="font-mono text-gray-500">
          {secondsRemaining !== undefined ? (
            <span className={secondsRemaining < 0 ? "text-red-500" : undefined}>
              {formatDuration(Math.abs(secondsRemaining))}
              {secondsRemaining < 0 ? " over" : null}
            </span>
          ) : (
            formatDuration(durationSeconds)
          )}
        </span>
      </div>
    );
  }
);

function durationTextToSeconds(durationText: string): number {
  const regex = /(\d+)\s+(hours?|minutes?|seconds?)/g;
  let match;
  let seconds = 0;
  while ((match = regex.exec(durationText)) !== null) {
    switch (match[2]) {
      case "hour":
      case "hours": {
        seconds += parseInt(match[1]) * 60 * 60;
        break;
      }
      case "minute":
      case "minutes": {
        seconds += parseInt(match[1]) * 60;
        break;
      }
      case "second":
      case "seconds": {
        seconds += parseInt(match[1]);
        break;
      }
    }
  }
  return seconds;
}

class TimerComponentData {
  constructor(readonly state: TimerState) {
    makeObservable(this, {
      isRunning: computed,
    });
  }

  get isRunning() {
    return this.state.runningEndTime !== undefined;
  }
}

class TimerComponent {
  id = generateNanoid();
  durationSeconds: number;
  state = observable({
    runningEndTime: undefined,
    pausedSecondsRemaining: undefined,
  });
  data: TimerComponentData;

  constructor(durationText: string) {
    this.durationSeconds = durationTextToSeconds(durationText);
    this.data = new TimerComponentData(this.state);
  }

  render() {
    return (
      <Timer
        durationSeconds={this.durationSeconds}
        state={this.state}
        key={this.id}
      />
    );
  }

  destroy() {}
}

export function createTimerComponent(durationText: string): TimerComponent {
  return new TimerComponent(durationText);
}
