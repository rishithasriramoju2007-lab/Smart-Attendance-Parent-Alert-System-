require("dotenv").config();

const express = require("express");
const cors = require("cors");
const twilio = require("twilio");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// -------------------- TWILIO CONFIGURATION --------------------

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const TWILIO_WHATSAPP_FROM =
  process.env.TWILIO_WHATSAPP_FROM;

// -------------------- COLLEGE DETAILS --------------------

const college = {
  name: "Sri Venkateshwara Engineering College",
  location: "Suryapet, Telangana",
  branch: "CSM",
  year: "3-2",
  section: "A",
};

// -------------------- PERIOD DETAILS --------------------

const periods = [
  { id: 1, name: "1st Period", start: "09:30 AM", end: "10:25 AM" },
  { id: 2, name: "2nd Period", start: "10:25 AM", end: "11:20 AM" },
  { id: 3, name: "3rd Period", start: "11:35 AM", end: "12:30 PM" },
  { id: 4, name: "4th Period", start: "01:30 PM", end: "02:25 PM" },
  { id: 5, name: "5th Period", start: "02:25 PM", end: "03:20 PM" },
  { id: 6, name: "6th Period", start: "03:20 PM", end: "04:15 PM" },
];

const subjects = {
  1: "Design and Analysis of Algorithms",
  2: "Machine Learning",
  3: "Computer Networks",
  4: "Business Economics and Financial Analysis",
  5: "Introduction to Data Science",
  6: "Machine Learning",
};

// -------------------- STUDENT DETAILS --------------------
// These are demo student records.
// Their phone fields are not used as actual WhatsApp destinations.

const students = [
  {
    rollNumber: "CSM301",
    name: "Rishitha Sriramoju",
    parentName: "Rammohan Sriramoju",
    phone: "9000000001",
    branch: "CSM",
    year: "3-2",
    section: "A",
  },
  {
    rollNumber: "CSM302",
    name: "Harshitha Ganna",
    parentName: "Laxminarayana",
    phone: "9000000002",
    branch: "CSM",
    year: "3-2",
    section: "A",
  },
  {
    rollNumber: "CSM303",
    name: "Vennela Kolishetti",
    parentName: "Narsaiah",
    phone: "9000000003",
    branch: "CSM",
    year: "3-2",
    section: "A",
  },
  {
    rollNumber: "CSM304",
    name: "Manasa Batthula",
    parentName: "Gopi",
    phone: "9000000004",
    branch: "CSM",
    year: "3-2",
    section: "A",
  },
  {
    rollNumber: "CSM305",
    name: "Mahesh Babu Ghattamaneni",
    parentName: "Krishna",
    phone: "9000000005",
    branch: "CSM",
    year: "3-2",
    section: "A",
  },
];

let attendance = [];
const notifications = [];

// -------------------- HELPERS --------------------

function getPeriodNames(periodIds) {
  return periodIds
    .map((id) => periods.find((p) => p.id === id)?.name)
    .filter(Boolean);
}

function getPeriodDetails(periodIds) {
  return periodIds
    .map((id) => {
      const period = periods.find((p) => p.id === id);

      return period
        ? `${period.name} (${period.start} - ${period.end})`
        : "";
    })
    .filter(Boolean)
    .join(", ");
}

// -------------------- WHATSAPP RECIPIENTS --------------------

function getWhatsAppRecipient(rollNumber) {
  // First, check for a recipient configured for this student.
  const recipient = process.env[`TWILIO_WHATSAPP_TO_${rollNumber}`];

  if (recipient && recipient.trim()) {
    return recipient.trim();
  }

  // Fall back to your general WhatsApp test number.
  const testRecipient = process.env.TWILIO_WHATSAPP_TO;

  if (testRecipient && testRecipient.trim()) {
    return testRecipient.trim();
  }

  return null;
}
// -------------------- SEND WHATSAPP --------------------

async function sendWhatsAppMessage(rollNumber, message) {
  try {
    if (
      !process.env.TWILIO_ACCOUNT_SID ||
      !process.env.TWILIO_AUTH_TOKEN ||
      !TWILIO_WHATSAPP_FROM
    ) {
      return {
        success: false,
        sid: null,
        error: "Twilio configuration is missing from backend/.env.",
      };
    }

    const recipient = getWhatsAppRecipient(rollNumber);

    if (!recipient) {
      return {
        success: false,
        sid: null,
        error: `Recipient not configured for ${rollNumber}.`,
      };
    }

    const response = await twilioClient.messages.create({
      from: TWILIO_WHATSAPP_FROM,
      to: recipient,
      body: message,
    });

    console.log(
      `WhatsApp message submitted for ${rollNumber}: ${response.sid}`
    );

    return {
      success: true,
      sid: response.sid,
      recipient,
    };
  } catch (error) {
    console.error("Twilio WhatsApp Error:", error.message);

    return {
      success: false,
      sid: null,
      error: error.message,
    };
  }
}

// -------------------- CREATE NOTIFICATION --------------------

async function createAndSendNotification(student) {
  let alertType = "Period Alert";
  let attendanceStatus = "Period absence";

  let englishMessage = "";
  let teluguMessage = "";

  if (student.allDayAbsent) {
    alertType = "Full-Day Alert";
    attendanceStatus = "Full-day absent";

    englishMessage =
      `SV College Attendance Alert:\n\n` +
      `Your ward ${student.name} was absent for all 6 periods today.\n` +
      `Total absent periods: 6.\n` +
      `Attendance status: Full-day absent.`;

    teluguMessage =
      `SV కాలేజ్ హాజరు సమాచారం:\n\n` +
      `మీ కుమారుడు/కుమార్తె ${student.name} ఈరోజు మొత్తం 6 పీరియడ్లకు హాజరు కాలేదు.\n` +
      `మొత్తం గైర్హాజరైన పీరియడ్లు: 6.\n` +
      `హాజరు స్థితి: పూర్తి రోజు గైర్హాజరు.`;
  } else if (student.maxConsecutive >= 3) {
    alertType = "Half-Day Alert";
    attendanceStatus = "Half-day absent";

    const periodText = getPeriodDetails(
      student.longestConsecutivePeriods
    );

    englishMessage =
      `SV College Attendance Alert:\n\n` +
      `Your ward ${student.name} was absent for consecutive periods today.\n` +
      `Consecutive periods: ${periodText}.\n` +
      `Total absent periods: ${student.absentPeriods}.\n` +
      `Attendance status: Half-day absent.`;

    teluguMessage =
      `SV కాలేజ్ హాజరు సమాచారం:\n\n` +
      `మీ కుమారుడు/కుమార్తె ${student.name} ఈరోజు వరుసగా కొన్ని పీరియడ్లకు హాజరు కాలేదు.\n` +
      `వరుసగా గైర్హాజరైన పీరియడ్లు: ${periodText}.\n` +
      `మొత్తం గైర్హాజరైన పీరియడ్లు: ${student.absentPeriods}.\n` +
      `హాజరు స్థితి: అర్ధ రోజు గైర్హాజరు.`;
  } else {
    const periodText = getPeriodDetails(student.absentPeriodIds);

    englishMessage =
      `SV College Attendance Alert:\n\n` +
      `Your ward ${student.name} was absent for ${periodText} today.\n` +
      `Total absent periods: ${student.absentPeriods}.`;

    teluguMessage =
      `SV కాలేజ్ హాజరు సమాచారం:\n\n` +
      `మీ కుమారుడు/కుమార్తె ${student.name} ఈరోజు ${periodText}కు హాజరు కాలేదు.\n` +
      `మొత్తం గైర్హాజరైన పీరియడ్లు: ${student.absentPeriods}.`;
  }

  const whatsappMessage =
    `${englishMessage}\n\n` +
    `--------------------\n\n` +
    `${teluguMessage}`;

  const messageResult = await sendWhatsAppMessage(
    student.rollNumber,
    whatsappMessage
  );

  const notification = {
    id: notifications.length + 1,
    rollNumber: student.rollNumber,
    studentName: student.name,
    parentName: student.parentName,
    type: alertType,
    alertStatus: alertType,
    absentPeriods: student.absentPeriods,
    absentPeriodIds: student.absentPeriodIds,
    consecutivePeriods: getPeriodNames(
      student.longestConsecutivePeriods
    ),
    attendanceStatus,
    deliveryStatus: messageResult.success ? "Sent" : "Failed",
    recipient: messageResult.recipient || null,
    englishMessage,
    teluguMessage,
    messageSid: messageResult.sid,
    error: messageResult.error || null,
    createdAt: new Date().toISOString(),
  };

  notifications.push(notification);

  return notification;
}

// -------------------- BASIC API ROUTES --------------------

app.get("/", (req, res) => {
  res.send("Smart Attendance Backend is running successfully.");
});

app.get("/api/college", (req, res) => {
  res.json(college);
});

app.get("/api/periods", (req, res) => {
  res.json(periods);
});

app.get("/api/subjects", (req, res) => {
  res.json(subjects);
});

app.get("/api/students", (req, res) => {
  res.json(students);
});

// -------------------- PROCESS ATTENDANCE --------------------

app.post("/api/process-attendance", async (req, res) => {
  try {
    const { attendanceData } = req.body;

    if (!Array.isArray(attendanceData) || attendanceData.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Attendance data must be a non-empty array.",
      });
    }

    const results = [];
    const newNotifications = [];

    let parentAlerts = 0;
    let halfDayAlerts = 0;
    let fullDayAlerts = 0;

    for (const row of attendanceData) {
      const rollNumber = String(row["Roll No"] || "").trim();
      const uploadedName = String(row["Student Name"] || "").trim();

      if (!rollNumber) {
        results.push({
          rollNumber: null,
          studentName: uploadedName,
          alertType: "Invalid Row",
          error: "Roll No is missing.",
        });
        continue;
      }

      const student = students.find(
        (item) => item.rollNumber === rollNumber
      );

      if (!student) {
        results.push({
          rollNumber,
          studentName: uploadedName,
          alertType: "Unknown Student",
          error: "Student roll number was not found in the configured list.",
        });
        continue;
      }

      const periodValues = [
        row.P1,
        row.P2,
        row.P3,
        row.P4,
        row.P5,
        row.P6,
      ];

      const absentPeriodIds = [];
      let currentConsecutive = 0;
      let maxConsecutive = 0;
      let currentConsecutivePeriods = [];
      let longestConsecutivePeriods = [];

      for (let i = 0; i < periodValues.length; i++) {
        const value = String(periodValues[i] ?? "")
          .trim()
          .toUpperCase();

        if (value === "A") {
          absentPeriodIds.push(i + 1);
          currentConsecutive++;
          currentConsecutivePeriods.push(i + 1);

          if (currentConsecutive > maxConsecutive) {
            maxConsecutive = currentConsecutive;
            longestConsecutivePeriods = [
              ...currentConsecutivePeriods,
            ];
          }
        } else {
          currentConsecutive = 0;
          currentConsecutivePeriods = [];
        }
      }

      const absentPeriods = absentPeriodIds.length;
      const allDayAbsent = absentPeriods === 6;

      let alertType = "No Alert";

      if (allDayAbsent) {
        alertType = "Full-Day Alert";
        fullDayAlerts++;
        parentAlerts++;
      } else if (maxConsecutive >= 3) {
        alertType = "Half-Day Alert";
        halfDayAlerts++;
        parentAlerts++;
      } else if (absentPeriods > 0) {
        alertType = "Period Alert";
        parentAlerts++;
      }

      const result = {
        rollNumber,
        studentName: student.name,
        absentPeriods,
        absentPeriodIds,
        maxConsecutive,
        longestConsecutivePeriods,
        allDayAbsent,
        alertType,
      };

      results.push(result);

      if (alertType !== "No Alert") {
        const notification = await createAndSendNotification({
          ...student,
          ...result,
        });

        newNotifications.push(notification);
      }
    }

    attendance = attendanceData;

    res.json({
      success: true,
      totalStudents: attendanceData.length,
      parentAlerts,
      halfDayAlerts,
      fullDayAlerts,
      results,
      notifications: newNotifications,
    });
  } catch (error) {
    console.error("Attendance processing error:", error);

    res.status(500).json({
      success: false,
      message: "Attendance processing failed.",
      error: error.message,
    });
  }
});

// -------------------- VIEW DATA --------------------

app.get("/api/attendance", (req, res) => {
  res.json(attendance);
});

app.get("/api/notifications", (req, res) => {
  res.json(notifications);
});

// -------------------- TEST ONE WHATSAPP RECIPIENT --------------------

app.post("/api/test-whatsapp", async (req, res) => {
  try {
    const { rollNumber, message } = req.body;

    const student = students.find(
      (item) => item.rollNumber === rollNumber
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student roll number not found.",
      });
    }

    const result = await sendWhatsAppMessage(
      rollNumber,
      message ||
        `Smart Attendance System test message for ${student.name}.`
    );

    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("WhatsApp test error:", error.message);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// -------------------- START SERVER --------------------

app.listen(PORT, () => {
  console.log(
    `Smart Attendance Backend running on port ${PORT}`
  );
  console.log("Twilio WhatsApp integration loaded.");
});
