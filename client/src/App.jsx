import React, { useState, useEffect, useRef, useCallback } from "react";
import * as ort from "onnxruntime-web";
import {
  Eclipse,
  Moon,
  Droplet,
  Heart,
  X,
  Flame,
  Shell,
  Bubbles,
  ScanFace,
  Brain,
  Spline,
  Egg,
  Download,
  ArrowBigUpDash,
} from "lucide-react";
import { v7 as uuidv7 } from "uuid";

import {
  initDB,
  saveToIndexedDB,
  getFromIndexedDB,
  getAllFromIndexedDB,
} from "./utils";

const DEFAULT_CYCLE_LEN = 28;

const SYMPTOMS = [
  { id: "cramps", label: "Cramps", icon: Flame, color: "text-red-500" },
  {
    id: "headache",
    label: "Headache",
    icon: Shell,
    color: "text-purple-500",
  },
  { id: "bloating", label: "Bloating", icon: Bubbles, color: "text-blue-500" },
  { id: "fatigue", label: "Fatigue", icon: Moon, color: "text-indigo-500" },
  { id: "mood", label: "Mood Changes", icon: Brain, color: "text-yellow-500" },
  { id: "acne", label: "Acne", icon: ScanFace, color: "text-green-500" },
  {
    id: "tender",
    label: "Tender Breasts",
    icon: Heart,
    color: "text-pink-500",
  },
  {
    id: "backache",
    label: "Back Pain",
    icon: Spline,
    color: "text-gray-500",
  },
];

const FLOW_LEVELS = ["spotting", "light", "medium", "heavy"];

let cycleWindowCounter;
let cycleStartDate;
let cycleHistory = new Set();

function App() {
  const [userId, setUserId] = useState(null);
  const [months, setMonths] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [entries, setEntries] = useState({});
  const [earliestEntry, setEarliestEntry] = useState(null);
  const [mostRecentStart, setMostRecentStart] = useState(null);
  const [nextCyclePred, setNextCyclePred] = useState(null);
  const [onnxSession, setOnnxSession] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState({
    isPeriod: false,
    isOvulating: false,
    flow: "",
    symptoms: [],
    notes: "",
  });
  const scrollRef = useRef(null);
  const loadingRef = useRef(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    initializeUser();
    loadEntries();
    initializeMonths().then((_) => {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight / 1.8,
        behavior: "smooth",
      });
    });
  }, []);

  useEffect(() => {
    const loadModel = async () => {
      const modelPath =
        process.env.NODE_ENV === "production"
          ? "/tide/xgb_model.onnx"
          : "/xgb_model.onnx";
      const sess = await ort.InferenceSession.create(modelPath);
      setOnnxSession(sess);
    };
    loadModel();
  }, []);

  useEffect(() => {
    if (onnxSession == null) return;
    if (cycleHistory.size === 0) return;
    if (cycleHistory.size < 2) {
      const n1Date = new Date(mostRecentStart);
      n1Date.setDate(n1Date.getDate() + DEFAULT_CYCLE_LEN);
      setNextCyclePred((prev) => n1Date.toISOString().split("T")[0]);
      return;
    }

    const timer = setTimeout(async () => {
      let cycleLenAgg = 0;
      let arr = [];
      let mu;
      let sig;
      let n2;
      let n1;

      cycleHistory.forEach((e) => {
        let [startDate, len] = e.split(":");
        cycleLenAgg += Number(len);
        arr.push(Number(len));
      });

      n2 = arr.at(-2);
      n1 = arr.at(-1);
      mu = cycleLenAgg / arr.length;
      sig = Math.sqrt(
        arr.reduce((sum, x) => sum + (x - mu) ** 2, 0) / (arr.length - 1),
      );

      const values = [mu, sig, n2, n1];
      const inputName = onnxSession.inputNames[0];

      const inputShape = [1, values.length]; // [batch_size, features]
      const inputTensor = new ort.Tensor(
        "float32",
        Float32Array.from(values),
        inputShape,
      );

      const feeds = { [inputName]: inputTensor };
      const results = await onnxSession.run(feeds);

      const outputName = onnxSession.outputNames[0];
      const output = Math.round(
        results[outputName].data[0] || DEFAULT_CYCLE_LEN,
      );

      const n1Date = new Date(mostRecentStart);
      // console.log(cycleHistory);
      // console.log(values, output);
      n1Date.setDate(n1Date.getDate() + output);
      // console.log(n1Date.toISOString());

      setNextCyclePred((prev) => n1Date.toISOString().split("T")[0]);
    }, 2000);

    return () => clearTimeout(timer);
  }, [earliestEntry, mostRecentStart, onnxSession]);

  const initializeMonths = async () => {
    const today = new Date();
    const monthsList = [];
    // Start with 3 months before current
    for (let i = -3; i <= 6; i++) {
      monthsList.push(new Date(today.getFullYear(), today.getMonth() + i, 1));
    }
    setMonths(monthsList);
  };

  const loadMoreMonths = useCallback((direction) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    setMonths((prev) => {
      const newMonths = [...prev];
      if (direction === "past") {
        const firstMonth = newMonths[0];
        for (let i = 3; i >= 1; i--) {
          newMonths.unshift(
            new Date(firstMonth.getFullYear(), firstMonth.getMonth() - i, 1),
          );
        }
      } else {
        const lastMonth = newMonths[newMonths.length - 1];
        for (let i = 1; i <= 3; i++) {
          newMonths.push(
            new Date(lastMonth.getFullYear(), lastMonth.getMonth() + i, 1),
          );
        }
      }
      return newMonths;
    });

    setTimeout(() => {
      loadingRef.current = false;
    }, 100);
  }, []);

  const handleScroll = useCallback(
    (e) => {
      const { scrollTop, scrollHeight, clientHeight } = e.target;

      if (scrollTop < 200) {
        loadMoreMonths("past");
      }

      if (scrollHeight - scrollTop - clientHeight < 200) {
        loadMoreMonths("future");
      }
    },
    [loadMoreMonths],
  );

  const initializeUser = async () => {
    let user = await getFromIndexedDB("userData", "currentUser");
    if (!user) {
      const newUserId = uuidv7();
      user = {
        id: "currentUser",
        userId: newUserId,
        createdAt: new Date().toISOString(),
      };
      await saveToIndexedDB("userData", user);
    }
    setUserId(user.userId);
  };

  const prevDay = (dateStr) => {
    let d = new Date(dateStr);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  };

  const findKeyLogEntries = (obj) => {
    let earliest = null;
    let mostRecent = null;
    for (const [key, val] of Object.entries(obj)) {
      if (earliest == null || key < earliest) earliest = key;
      if (
        val.isPeriod &&
        !obj[prevDay(key)]?.isPeriod &&
        (mostRecent == null || key > mostRecent)
      )
        mostRecent = key;
    }
    // console.log(`${earliest}`);
    setEarliestEntry(earliest);
    setMostRecentStart(mostRecent);
  };

  const loadEntries = async () => {
    const allEntries = await getAllFromIndexedDB("entries");
    const entriesMap = {};
    allEntries.forEach((entry) => {
      entriesMap[entry.date] = entry;
    });
    setEntries(entriesMap);
    findKeyLogEntries(entriesMap);
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const formatDate = (year, month, day) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(
      day,
    ).padStart(2, "0")}`;
  };

  const handleDayClick = (day, month) => {
    const dateStr = formatDate(month.getFullYear(), month.getMonth(), day);
    setSelectedDate(dateStr);

    const existing = entries[dateStr];
    setModalData(
      existing
        ? {
            isPeriod: existing.isPeriod,
            isOvulating: existing.isOvulating,
            flow: existing.flow || "",
            symptoms: existing.symptoms || [],
            notes: existing.notes || "",
          }
        : {
            isPeriod: false,
            isOvulating: false,
            flow: "",
            symptoms: [],
            notes: "",
          },
    );

    setShowModal(true);
  };

  const handleSave = async () => {
    const entry = {
      id: `${userId}_${selectedDate}`,
      userId,
      date: selectedDate,
      ...modalData,
      updatedAt: new Date().toISOString(),
    };

    await saveToIndexedDB("entries", entry);
    setEntries((prev) => {
      const newEntries = { ...prev, [selectedDate]: entry };
      findKeyLogEntries(newEntries);
      return newEntries;
    });
    setShowModal(false);
  };

  const handleDelete = async () => {
    const db = await initDB();
    const transaction = db.transaction(["entries"], "readwrite");
    const store = transaction.objectStore("entries");
    await store.delete(`${userId}_${selectedDate}`);

    setEntries((prev) => {
      const newEntries = { ...prev };
      delete newEntries[selectedDate];
      findKeyLogEntries(newEntries);
      return newEntries;
    });
    setShowModal(false);
  };

  const toggleSymptom = (symptomId) => {
    setModalData((prev) => ({
      ...prev,
      symptoms: prev.symptoms.includes(symptomId)
        ? prev.symptoms.filter((s) => s !== symptomId)
        : [...prev.symptoms, symptomId],
    }));
  };

  const renderCalendar = (date) => {
    const { daysInMonth, startingDayOfWeek, year, month } =
      getDaysInMonth(date);

    const monthName = date.toLocaleString("default", {
      month: "long",
      year: "numeric",
    });
    const days = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(
        <div key={`empty-${i}`} className="h-10 sm:h-12 md:h-14"></div>,
      );
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formatDate(year, month, day);
      const entry = entries[dateStr];
      const isToday =
        dateStr ===
        formatDate(
          new Date().getFullYear(),
          new Date().getMonth(),
          new Date().getDate(),
        );

      if (
        dateStr >= earliestEntry &&
        ((nextCyclePred && dateStr <= nextCyclePred) ||
          dateStr <= new Date().toISOString().split("T")[0])
      ) {
        if (entry?.isPeriod && !entries[prevDay(dateStr)]?.isPeriod) {
          if (cycleWindowCounter && cycleStartDate) {
            // console.log(`${cycleStartDate}: ${cycleWindowCounter}`);
            cycleHistory.add([cycleStartDate, cycleWindowCounter].join(":"));
          }
          cycleWindowCounter = 1;
          cycleStartDate = dateStr;
        } else cycleWindowCounter++;
      } else cycleWindowCounter = 0;

      days.push(
        <button
          key={day}
          onClick={() => handleDayClick(day, date)}
          className={`h-10 grid grid-cols-3 grid-rows-3 transition-all hover:bg-rose-50 relative
    ${isToday ? "text-primary" : ""}
  ${entry?.isOvulating ? "rounded-full text-yellow-800 bg-yellow-200" : ""}
  ${
    entry?.isPeriod
      ? "rounded-full text-rose-800 " +
        (entry?.flow == FLOW_LEVELS[0]
          ? "bg-rose-50"
          : entry?.flow == FLOW_LEVELS[1]
            ? "bg-rose-100"
            : entry?.flow == FLOW_LEVELS[2]
              ? "bg-rose-200"
              : entry?.flow == FLOW_LEVELS[3]
                ? "bg-rose-300"
                : "")
      : ""
  }
  `}
        >
          <div
            className={`absolute inset-0 m-auto w-10 h-10 z-10 pointer-events-none flex items-center justify-center opacity-50
  ${nextCyclePred && dateStr == nextCyclePred ? "rounded-full outline-dotted outline-6 outline-rose-800 animate-spin [animation-duration:12s]" : ""}
  `}
          ></div>

          {/* Top-left: Cycle counter */}
          {earliestEntry && mostRecentStart && cycleWindowCounter > 0 && (
            <div className="text-[0.6rem] text-gray-500 col-start-1 row-start-1 self-start justify-self-start p-0.5">
              {cycleWindowCounter}
            </div>
          )}

          {/* Center: Day number */}
          <span className="text-base col-start-2 row-start-2 self-center justify-self-center">
            {day}
          </span>

          {/* Top-right: Symptoms indicator */}
          {entry?.symptoms && entry.symptoms.length > 0 && (
            <div className="col-start-3 row-start-1 self-start justify-self-end p-1">
              <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
            </div>
          )}
        </button>,
      );
    }

    return (
      <div className="mb-6 sm:mb-8">
        <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-800">
          {monthName}
        </h2>
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div
              key={i}
              className="text-center text-xs font-medium text-gray-500"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">{days}</div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-gray100 to-blue-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        <div className="flex justify-between gap-2 sm:gap-3 mb-6 sm:mb-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-rose-400 to-pink-500 rounded-2xl flex items-center justify-center">
              <Eclipse className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Tide
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const json = JSON.stringify(entries, null, 2);
                const blob = new Blob([json], { type: "text/json" });
                const url = URL.createObjectURL(blob);

                const today = new Date().toISOString().split("T")[0];
                const link = document.createElement("a");
                link.href = url;
                link.download = `${today}_tide.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              }}
            >
              <Download />
            </button>
            <button onClick={() => fileInputRef.current?.click()}>
              <ArrowBigUpDash />
              <input
                type="file"
                accept="application/json"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = async (event) => {
                    try {
                      const json = JSON.parse(event.target.result);
                      for (const [_, val] of Object.entries(json)) {
                        await saveToIndexedDB("entries", val);
                      }
                      setEntries(json);
                    } catch (error) {
                      console.error("Error parsing JSON import:", error);
                    }
                  };
                  reader.readAsText(file);
                }}
              />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-[calc(100vh-120px)] sm:h-[calc(100vh-140px)] overflow-y-auto"
        >
          <div className="space-y-6 sm:space-y-8">
            {months.map((month, idx) => (
              <div key={`${month.getFullYear()}-${month.getMonth()}-${idx}`}>
                {renderCalendar(month)}
              </div>
            ))}
          </div>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900">
                    {new Date(selectedDate).toLocaleDateString("default", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </h3>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>

                <div className="space-y-4 sm:space-y-4">
                  <div>
                    <label
                      className={`flex items-center gap-2 sm:gap-3 cursor-pointer p-3 sm:p-4 rounded-xl border-2 transition-all
                      ${
                        modalData.isOvulating
                          ? "border-yellow-400 bg-yellow-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={modalData.isOvulating}
                        onChange={(e) =>
                          setModalData((prev) => ({
                            ...prev,
                            isOvulating: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500 rounded"
                      />
                      <Egg className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
                      <span className="text-sm sm:text-base font-medium text-gray-900">
                        Ovulation day
                      </span>
                    </label>
                  </div>

                  <div>
                    <label
                      className={`flex items-center gap-2 sm:gap-3 cursor-pointer p-3 sm:p-4 rounded-xl border-2 transition-all
                      ${
                        modalData.isPeriod
                          ? "border-rose-400 bg-rose-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={modalData.isPeriod}
                        onChange={(e) =>
                          setModalData((prev) => ({
                            ...prev,
                            isPeriod: e.target.checked,
                            flow: e.target.checked ? FLOW_LEVELS[1] : "",
                          }))
                        }
                        className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500 rounded"
                      />
                      <Droplet className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500" />
                      <span className="text-sm sm:text-base font-medium text-gray-900">
                        Period day
                      </span>
                    </label>
                  </div>

                  {modalData.isPeriod && (
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                        Flow level
                      </label>
                      <div className="grid grid-cols-2 sm:flex gap-2">
                        {FLOW_LEVELS.map((level) => (
                          <button
                            key={level}
                            onClick={() =>
                              setModalData((prev) => ({ ...prev, flow: level }))
                            }
                            className={`flex-1 py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-all capitalize
                              ${
                                modalData.flow === level
                                  ? "bg-rose-500 text-white"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              }`}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">
                      Symptoms
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {SYMPTOMS.map((symptom) => {
                        const Icon = symptom.icon;
                        const isSelected = modalData.symptoms.includes(
                          symptom.id,
                        );
                        return (
                          <button
                            key={symptom.id}
                            onClick={() => toggleSymptom(symptom.id)}
                            className={`p-2 sm:p-3 rounded-lg text-left transition-all flex items-center gap-2
                              ${
                                isSelected
                                  ? "bg-blue-50 border-2 border-blue-400"
                                  : "bg-gray-50 border-2 border-transparent hover:bg-gray-100"
                              }`}
                          >
                            <Icon
                              className={`w-3 h-3 sm:w-4 sm:h-4 ${
                                isSelected ? symptom.color : "text-gray-400"
                              }`}
                            />
                            <span className="text-xs sm:text-sm font-medium text-gray-700">
                              {symptom.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={modalData.notes}
                      onChange={(e) =>
                        setModalData((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                      placeholder="Add any additional notes..."
                      className="w-full p-2 sm:p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-400 focus:border-transparent"
                      rows="3"
                    />
                  </div>

                  <div className="flex gap-2 sm:gap-3">
                    <button
                      disabled={modalData.isPeriod && modalData.flow == ""}
                      onClick={handleSave}
                      className="disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed flex-1 bg-rose-500 text-white py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-medium hover:bg-rose-600 transition-colors"
                    >
                      Save
                    </button>
                    {entries[selectedDate] && (
                      <button
                        onClick={handleDelete}
                        className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-100 text-gray-700 rounded-lg text-sm sm:text-base font-medium hover:bg-gray-200 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
