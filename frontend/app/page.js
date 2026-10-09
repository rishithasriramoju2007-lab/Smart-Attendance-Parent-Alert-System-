"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function Home() {
  const [file, setFile] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const periods = [
    { id: 1, name: "1st Period", time: "09:30 AM - 10:25 AM" },
    { id: 2, name: "2nd Period", time: "10:25 AM - 11:20 AM" },
    { id: 3, name: "3rd Period", time: "11:35 AM - 12:30 PM" },
    { id: 4, name: "4th Period", time: "01:30 PM - 02:25 PM" },
    { id: 5, name: "5th Period", time: "02:25 PM - 03:20 PM" },
    { id: 6, name: "6th Period", time: "03:20 PM - 04:15 PM" },
  ];

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];

    if (selectedFile) {
      setFile(selectedFile);
      setError("");
      setAttendanceData([]);
      setResults([]);
      setSummary(null);
      setNotifications([]);
    }
  };

  const handleProcessAttendance = async () => {
    if (!file) {
      setError("Please select an Excel attendance file first.");
      return;
    }

    setLoading(true);
    setError("");
    setResults([]);
    setSummary(null);
    setNotifications([]);

    try {
      const buffer = await file.arrayBuffer();

      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        throw new Error("The Excel file does not contain a worksheet.");
      }

      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, {
        defval: "",
      });

      if (data.length === 0) {
        throw new Error("The Excel file is empty.");
      }

      const requiredColumns = [
        "Roll No",
        "Student Name",
        "P1",
        "P2",
        "P3",
        "P4",
        "P5",
        "P6",
      ];

      const missingColumns = requiredColumns.filter(
        (column) => !(column in data[0])
      );

      if (missingColumns.length > 0) {
        throw new Error(
          "Missing columns: " + missingColumns.join(", ")
        );
      }

      // Validate attendance values before sending the data.
      const validAttendanceValues = ["A", "P"];

      for (let i = 0; i < data.length; i++) {
        for (const period of ["P1", "P2", "P3", "P4", "P5", "P6"]) {
          const value = String(data[i][period]).trim().toUpperCase();

          if (!validAttendanceValues.includes(value)) {
            throw new Error(
              `Invalid attendance in row ${i + 2}, column ${period}. Use P for Present or A for Absent.`
            );
          }

          data[i][period] = value;
        }

        if (
          !String(data[i]["Roll No"]).trim() ||
          !String(data[i]["Student Name"]).trim()
        ) {
          throw new Error(
            `Roll No or Student Name is missing in Excel row ${i + 2}.`
          );
        }
      }

      setAttendanceData(data);

      const response = await fetch(
        `${API_URL}/api/process-attendance`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            attendanceData: data,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Attendance processing failed."
        );
      }

      setSummary({
        totalStudents: result.totalStudents ?? data.length,
        parentAlerts: result.parentAlerts ?? 0,
        halfDayAlerts: result.halfDayAlerts ?? 0,
        fullDayAlerts: result.fullDayAlerts ?? 0,
      });

      setResults(Array.isArray(result.results) ? result.results : []);

      // Fetch notification history separately so a history error
      // does not hide the attendance processing results.
      try {
        const notificationResponse = await fetch(
          `${API_URL}/api/notifications`
        );

        if (notificationResponse.ok) {
          const notificationResult = await notificationResponse.json();

          setNotifications(
            Array.isArray(notificationResult)
              ? notificationResult
              : []
          );
        }
      } catch (notificationError) {
        console.error(
          "Could not load notification history:",
          notificationError
        );
      }
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          "Something went wrong while processing attendance."
      );
    } finally {
      setLoading(false);
    }
  };

  const getAlertClass = (type) => {
    if (type === "No Alert") return "no-alert";
    if (type === "Half-Day Alert") return "half-day";
    return "sent";
  };

  const getAttendanceColor = (value) =>
    String(value).trim().toUpperCase() === "A"
      ? "#b91c1c"
      : "#15803d";

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>Smart Attendance &amp; Parent Alert System</h1>
          <p>
            Automated Period-Wise Attendance Monitoring and
            Multilingual Parent Notification System
          </p>
        </div>

        <div className="dashboard-label">
          SV College • Suryapet
        </div>
      </header>

      <main className="container">
        {/* ATTENDANCE UPLOAD */}

        <section className="upload-card">
          <h2>Upload Attendance</h2>

          <p className="description">
            Upload the teacher&apos;s period-wise attendance Excel
            file. The system analyzes attendance patterns and
            generates parent alerts.
          </p>

          <div className="upload-box">
            <div className="upload-icon">↑</div>

            <h3>Upload Attendance Excel File</h3>

            <p>Select a .xlsx or .xls attendance file</p>

            <label className="choose-button">
              Choose File
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
              />
            </label>

            {file && (
              <p className="file-name">
                Selected: {file.name}
              </p>
            )}
          </div>

          <button
            className="process-button"
            onClick={handleProcessAttendance}
            disabled={loading}
            type="button"
          >
            {loading ? "Processing Attendance..." : "Process Attendance"}
          </button>

          {error && (
            <p
              role="alert"
              style={{
                color: "#b91c1c",
                textAlign: "center",
                marginTop: "18px",
                fontWeight: "600",
                overflowWrap: "anywhere",
              }}
            >
              {error}
            </p>
          )}
        </section>

        {/* ATTENDANCE SUMMARY */}

        {summary && (
          <section className="summary-card">
            <h2>Attendance Summary</h2>

            <div className="summary-grid">
              <div className="summary-item">
                <span>Total Students</span>
                <strong>{summary.totalStudents}</strong>
              </div>

              <div className="summary-item">
                <span>Parent Alerts</span>
                <strong>{summary.parentAlerts}</strong>
              </div>

              <div className="summary-item">
                <span>Half-Day Alerts</span>
                <strong>{summary.halfDayAlerts}</strong>
              </div>

              <div className="summary-item">
                <span>Full-Day Alerts</span>
                <strong>{summary.fullDayAlerts}</strong>
              </div>
            </div>
          </section>
        )}

        {/* SMART ATTENDANCE ANALYSIS */}

        {results.length > 0 && (
          <section className="alerts-card">
            <h2>Smart Attendance Analysis</h2>

            <p className="description">
              View individual student absence patterns and alert
              statuses returned by the backend.
            </p>

            <div className="alert-table">
              <div className="table-heading">
                <div>Student</div>
                <div>Absence Pattern</div>
                <div>Alert Status</div>
              </div>

              {results.map((student, index) => (
                <div className="table-row" key={index}>
                  <div>
                    <strong>{student.studentName}</strong>
                    <br />
                    <small>{student.rollNumber}</small>
                  </div>

                  <div>
                    {student.absentPeriods === 0
                      ? "All periods present"
                      : `${student.absentPeriods} absent period${
                          student.absentPeriods === 1 ? "" : "s"
                        }`}
                  </div>

                  <div className={getAlertClass(student.alertType)}>
                    {student.alertType}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* UPLOADED ATTENDANCE TABLE */}

        {attendanceData.length > 0 && (
          <section className="alerts-card">
            <h2>Uploaded Attendance</h2>

            <p className="description">
              Period-wise attendance records uploaded by the faculty.
            </p>

            <div style={{ overflowX: "auto", width: "100%" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: "600px",
                  borderCollapse: "collapse",
                  fontSize: "14px",
                }}
              >
                <thead>
                  <tr style={{ background: "#eef4fb", color: "#475569" }}>
                    <th style={{ padding: "14px", textAlign: "left" }}>
                      Roll No
                    </th>

                    <th style={{ padding: "14px", textAlign: "left" }}>
                      Student Name
                    </th>

                    {periods.map((period) => (
                      <th
                        key={period.id}
                        style={{ padding: "14px", textAlign: "center" }}
                      >
                        P{period.id}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {attendanceData.map((student, index) => (
                    <tr
                      key={`${student["Roll No"]}-${index}`}
                      style={{ borderTop: "1px solid #e2e8f0" }}
                    >
                      <td style={{ padding: "14px" }}>
                        {student["Roll No"]}
                      </td>

                      <td style={{ padding: "14px" }}>
                        {student["Student Name"]}
                      </td>

                      {["P1", "P2", "P3", "P4", "P5", "P6"].map(
                        (period) => (
                          <td
                            key={period}
                            style={{
                              padding: "14px",
                              textAlign: "center",
                              fontWeight: "600",
                              color: getAttendanceColor(student[period]),
                            }}
                          >
                            {student[period]}
                          </td>
                        )
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* PARENT NOTIFICATION HISTORY */}

        {notifications.length > 0 && (
          <section className="notification-card">
            <h2>Parent Notifications &amp; History</h2>

            <p className="description">
              Review notification records, timestamps, WhatsApp
              statuses, and English and Telugu messages returned
              by the backend.
            </p>

            {notifications.map((notification, index) => (
              <div
                key={notification.id ?? index}
                style={{
                  borderTop: "1px solid #e2e8f0",
                  paddingTop: "22px",
                  marginTop: "22px",
                }}
              >
                <div className="notification-details">
                  <span>
                    <strong>Student:</strong>{" "}
                    {notification.studentName || "Not available"}
                  </span>

                  <span>
                    <strong>Parent:</strong>{" "}
                    {notification.parentName || "Not available"}
                  </span>

                  <span>
                    <strong>Alert:</strong>{" "}
                    {notification.type || "Not available"}
                  </span>

                  <span>
                    <strong>Date &amp; Time:</strong>{" "}
                    {notification.createdAt
                      ? new Date(notification.createdAt).toLocaleString()
                      : "Not available"}
                  </span>

                  <span>
                    <strong>Status:</strong>{" "}
                    <span
                      className={
                        notification.deliveryStatus === "Sent"
                          ? "sent"
                          : notification.deliveryStatus === "Failed"
                            ? "half-day"
                            : "no-alert"
                      }
                    >
                      {notification.deliveryStatus || "Unknown"}
                    </span>
                  </span>
                </div>

                <div className="message-box">
                  <strong>English Message</strong>
                  <p>
                    {notification.englishMessage || "No English message available."}
                  </p>
                </div>

                <div className="message-box telugu">
                  <strong>Telugu Message</strong>
                  <p>
                    {notification.teluguMessage || "No Telugu message available."}
                  </p>
                </div>

                {notification.messageSid && (
                  <p
                    style={{
                      marginTop: "12px",
                      color: "#64748b",
                      fontSize: "12px",
                      overflowWrap: "anywhere",
                    }}
                  >
                    Message ID: {notification.messageSid}
                  </p>
                )}
              </div>
            ))}
          </section>
        )}

        {/* COLLEGE PERIOD SCHEDULE */}

        <section className="alerts-card">
          <h2>College Period Schedule</h2>

          <p className="description">
            Daily period timings used by the attendance monitoring system.
          </p>

          <div className="alert-table">
            <div className="table-heading">
              <div>Period</div>
              <div>Time</div>
              <div>Status</div>
            </div>

            {periods.map((period) => (
              <div className="table-row" key={period.id}>
                <div>
                  <strong>{period.name}</strong>
                </div>

                <div>{period.time}</div>

                <div className="sent">Active</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}