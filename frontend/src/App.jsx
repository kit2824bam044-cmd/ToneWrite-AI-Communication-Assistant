import { useRef, useState } from "react";
import "./App.css";

function App() {
  const [mode, setMode] = useState("create");

  const [message, setMessage] = useState("");
  const [senderName, setSenderName] = useState("");
  const [recipientName, setRecipientName] = useState("");

  const [type, setType] = useState("Letter");
  const [tone, setTone] = useState("Professional");
  const [length, setLength] = useState("Medium");

  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const [listening, setListening] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState("en-IN");

  const [selectedFile, setSelectedFile] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [extracting, setExtracting] = useState(false);

  const recognitionRef = useRef(null);

  const currentDate = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  /* =========================
     VOICE INPUT
  ========================= */

  const startVoiceInput = () => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Voice input is not supported in this browser. Please use Google Chrome."
      );
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = voiceLanguage;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onresult = (event) => {
      const spokenText =
        event.results[0][0].transcript;

      setMessage((previous) =>
        previous
          ? `${previous} ${spokenText}`
          : spokenText
      );
    };

    recognition.onerror = (event) => {
      console.error("Voice error:", event.error);

      if (event.error === "not-allowed") {
        alert(
          "Microphone permission denied. Please allow microphone access."
        );
      } else if (event.error === "no-speech") {
        alert("No speech detected. Please try again.");
      } else {
        alert(
          "Voice input failed. Please try again."
        );
      }

      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.error(error);
      setListening(false);
    }
  };

  /* =========================
     CREATE
  ========================= */

  const generateMessage = async () => {
    if (!senderName.trim()) {
      alert("Please enter your name.");
      return;
    }

    if (!recipientName.trim()) {
      alert("Please enter the recipient name.");
      return;
    }

    if (!message.trim()) {
      alert("Please type or speak your message.");
      return;
    }

    setLoading(true);
    setResult("");

    try {
      const response = await fetch(
        "http://localhost:5000/api/generate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
            senderName,
            recipientName,
            type,
            tone,
            length,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Generation failed"
        );
      }

      setResult(data.result || "");
    } catch (error) {
      console.error(error);

      setResult(
        "Something went wrong. Please make sure the backend and Ollama are running."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     FILE UPLOAD
  ========================= */

  const uploadFile = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = [
      ".pdf",
      ".docx",
      ".txt",
    ];

    const fileName = file.name.toLowerCase();

    const supported = allowedTypes.some(
      (extension) =>
        fileName.endsWith(extension)
    );

    if (!supported) {
      alert(
        "Only PDF, DOCX and TXT files are supported."
      );
      return;
    }

    setSelectedFile(file);
    setExtracting(true);
    setExtractedText("");
    setMessage("");
    setResult("");

    try {
      const formData = new FormData();

      formData.append("file", file);

      const response = await fetch(
        "http://localhost:5000/api/extract",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Could not extract document."
        );
      }

      setExtractedText(data.text || "");
      setMessage(data.text || "");
    } catch (error) {
      console.error(error);

      alert(
        error.message ||
          "Could not read the uploaded file."
      );

      setSelectedFile(null);
    } finally {
      setExtracting(false);
    }
  };

  /* =========================
     REWRITE
  ========================= */

  const rewriteUploadedFile = async () => {
    const text =
      extractedText.trim() ||
      message.trim();

    if (!text) {
      alert(
        "Please upload a document or enter text."
      );
      return;
    }

    if (!senderName.trim()) {
      alert("Please enter your name.");
      return;
    }

    if (!recipientName.trim()) {
      alert("Please enter the recipient name.");
      return;
    }

    setLoading(true);
    setResult("");

    try {
      const response = await fetch(
        "http://localhost:5000/api/rewrite",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            senderName,
            recipientName,
            type,
            tone,
            length,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Rewrite failed."
        );
      }

      setResult(data.result || "");
    } catch (error) {
      console.error(error);

      alert(
        error.message ||
          "Something went wrong while rewriting."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     HELPERS
  ========================= */

  const cleanResult = (text) => {
    if (!text) return "";

    return text
      .replace(/^```[\w]*\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  };

  const getSubject = (text) => {
    const cleaned = cleanResult(text);

    const match = cleaned.match(
      /^Subject\s*:\s*(.+)$/im
    );

    return match
      ? match[1].trim()
      : "Professional Communication";
  };

  const getBodyWithoutSubject = (text) => {
    const cleaned = cleanResult(text);

    return cleaned
      .replace(
        /^Subject\s*:\s*.+$/im,
        ""
      )
      .trim();
  };

  const getParagraphs = (text) => {
    const cleaned =
      getBodyWithoutSubject(text);

    if (!cleaned) return [];

    return cleaned
      .split(/\n\s*\n/)
      .map((paragraph) =>
        paragraph.trim()
      )
      .filter(Boolean);
  };

  const formatParagraph = (paragraph) => {
    return paragraph
      .replace(
        /^Dear\s+.*?:?\s*$/im,
        ""
      )
      .replace(
        /^Respected\s+.*?:?\s*$/im,
        ""
      )
      .replace(
        /^Sincerely,?\s*$/im,
        ""
      )
      .replace(
        /^Yours sincerely,?\s*$/im,
        ""
      )
      .replace(
        /^Yours faithfully,?\s*$/im,
        ""
      )
      .replace(
        /^Kind regards,?\s*$/im,
        ""
      )
      .replace(
        /^Best regards,?\s*$/im,
        ""
      )
      .trim();
  };

  const getGreeting = () => {
    const name =
      recipientName.trim();

    if (!name) {
      return "Dear Sir/Madam,";
    }

    return `Dear ${name},`;
  };

  const getLetterClosing = () => {
    if (
      tone === "Friendly" ||
      tone === "Appreciative" ||
      tone === "Polite"
    ) {
      return "Kind regards,";
    }

    return "Sincerely,";
  };

  const getEmailClosing = () => {
    if (tone === "Formal") {
      return "Yours sincerely,";
    }

    if (tone === "Friendly") {
      return "Best regards,";
    }

    return "Kind regards,";
  };

  /* =========================
     LETTER
  ========================= */

  const renderLetter = () => {
    const subject =
      getSubject(result);

    const paragraphs =
      getParagraphs(result);

    return (
      <div className="professional-document letter-document">

        <div className="letter-sender">
          <strong>
            {senderName || "Your Name"}
          </strong>

          <span>
            CSE Department
          </span>

          <span>
            KIT-Kalaignarkarunanidhi Institute of Technology
          </span>

          <span>
            Coimbatore
          </span>
        </div>

        <div className="letter-date">
          {currentDate}
        </div>

        <div className="letter-recipient">

          <strong>
            {recipientName ||
              "Recipient Name"}
          </strong>

          <span>
            Department of CSE
          </span>

          <span>
            KIT-Kalaignarkarunanidhi Institute of Technology
          </span>

          <span>
            Coimbatore
          </span>

        </div>

        <div className="letter-subject">
          <strong>Subject:</strong>{" "}
          {subject}
        </div>

        <div className="letter-greeting">
          {getGreeting()}
        </div>

        <div className="letter-body">

          {paragraphs.length > 0 ? (
            paragraphs.map(
              (paragraph, index) => {

                const cleaned =
                  formatParagraph(
                    paragraph
                  );

                if (!cleaned) {
                  return null;
                }

                return (
                  <p key={index}>
                    {cleaned}
                  </p>
                );
              }
            )
          ) : (
            <p>
              Your professionally
              generated letter will
              appear here.
            </p>
          )}

        </div>

        <div className="letter-closing">

          <span>
            {getLetterClosing()}
          </span>

          <strong>
            {senderName ||
              "Your Name"}
          </strong>

        </div>

      </div>
    );
  };

  /* =========================
     EMAIL
  ========================= */

  const renderEmail = () => {
    const subject =
      getSubject(result);

    const paragraphs =
      getParagraphs(result);

    return (
      <div className="professional-document email-document">

        <div className="email-meta">

          <div className="email-meta-row">
            <span>To</span>
            <strong>
              {recipientName ||
                "Recipient Name"}
            </strong>
          </div>

          <div className="email-meta-row">
            <span>From</span>
            <strong>
              {senderName ||
                "Your Name"}
            </strong>
          </div>

          <div className="email-meta-row">
            <span>Subject</span>
            <strong>
              {subject}
            </strong>
          </div>

        </div>

        <div className="email-divider"></div>

        <div className="email-body">

          <div className="email-greeting">
            {getGreeting()}
          </div>

          {paragraphs.length > 0 ? (
            paragraphs.map(
              (paragraph, index) => {

                const cleaned =
                  formatParagraph(
                    paragraph
                  );

                if (!cleaned) {
                  return null;
                }

                return (
                  <p key={index}>
                    {cleaned}
                  </p>
                );
              }
            )
          ) : (
            <p>
              Your professionally
              generated email will
              appear here.
            </p>
          )}

          <div className="email-closing">

            <span>
              {getEmailClosing()}
            </span>

            <strong>
              {senderName ||
                "Your Name"}
            </strong>

          </div>

        </div>

      </div>
    );
  };

  /* =========================
     MESSAGE
  ========================= */

  const renderMessage = () => {
    const messageText =
      getBodyWithoutSubject(
        result
      );

    return (
      <div className="professional-message">

        <div className="message-header">

          <div className="message-avatar">
            {(recipientName ||
              "R")
              .charAt(0)
              .toUpperCase()}
          </div>

          <div className="message-person">

            <strong>
              {recipientName ||
                "Recipient Name"}
            </strong>

            <span>
              Professional Message
            </span>

          </div>

        </div>

        <div className="message-body-area">

          {!messageText ? (
            <div className="message-placeholder">
              Your generated message
              will appear here.
            </div>
          ) : (
            <div className="message-bubble">
              {messageText}
            </div>
          )}

        </div>

      </div>
    );
  };

  /* =========================
     COPY
  ========================= */

  const copyDocument = async () => {
    if (!result) {
      alert(
        "Please generate a document first."
      );
      return;
    }

    try {
      let copyText =
        cleanResult(result);

      if (type === "Email") {
        copyText =
          `To: ${recipientName}\n` +
          `From: ${senderName}\n` +
          `Subject: ${getSubject(result)}\n\n` +
          getBodyWithoutSubject(result);
      }

      if (type === "Letter") {
        copyText =
          `${senderName}\n` +
          `CSE Department\n` +
          `KIT-Kalaignarkarunanidhi Institute of Technology\n` +
          `Coimbatore\n\n` +
          `${currentDate}\n\n` +
          `${recipientName}\n` +
          `Department of CSE\n` +
          `KIT-Kalaignarkarunanidhi Institute of Technology\n` +
          `Coimbatore\n\n` +
          `Subject: ${getSubject(result)}\n\n` +
          `${getGreeting()}\n\n` +
          `${getBodyWithoutSubject(result)}\n\n` +
          `${getLetterClosing()}\n` +
          `${senderName}`;
      }

      if (type === "Message") {
        copyText =
          `${recipientName}\n\n` +
          getBodyWithoutSubject(
            result
          );
      }

      await navigator.clipboard.writeText(
        copyText
      );

      alert("Copied successfully!");
    } catch (error) {
      console.error(error);
      alert("Copy failed.");
    }
  };

  /* =========================
     PRINT
  ========================= */

  const printDocument = () => {
    if (!result) {
      alert(
        "Please generate a document first."
      );
      return;
    }

    window.print();
  };

  return (
    <div className="app">

      <header className="topbar">

        <div className="brand">

          <div className="brand-logo">
            T
          </div>

          <div>
            <h1>ToneWrite</h1>

            <p>
              AI Communication Assistant
            </p>
          </div>

        </div>

        <div className="ai-status">
          <span></span>
          AI Ready
        </div>

      </header>

      <main className="workspace">

        {/* =========================
            LEFT
        ========================= */}

        <section className="composer">

          <div className="mode-switch">

            <button
              type="button"
              className={
                mode === "create"
                  ? "active"
                  : ""
              }
              onClick={() => {
                setMode("create");
                setResult("");
              }}
            >
              Create New
            </button>

            <button
              type="button"
              className={
                mode === "rewrite"
                  ? "active"
                  : ""
              }
              onClick={() => {
                setMode("rewrite");
                setResult("");
              }}
            >
              Rewrite Existing
            </button>

          </div>

          <div className="intro">

            <span>
              {mode === "create"
                ? "CREATE"
                : "REWRITE"}
            </span>

            <h2>
              {mode === "create"
                ? "Turn your thoughts into professional words."
                : "Improve your existing document professionally."}
            </h2>

            <p>
              {mode === "create"
                ? "Write naturally and let AI transform your thoughts into a professional communication."
                : "Upload an existing document, review the text, choose a tone and let AI rewrite it professionally."}
            </p>

          </div>

          {/* FILE UPLOAD */}

          {mode === "rewrite" && (
            <div className="form-section">

              <div className="section-title">
                <b>01</b>
                Upload document
              </div>

              <label className="upload-box">

                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={uploadFile}
                  hidden
                />

                <strong>
                  {extracting
                    ? "Reading document..."
                    : "Click to upload your document"}
                </strong>

                <small>
                  PDF / DOCX / TXT
                </small>

              </label>

              {selectedFile && (
                <div className="selected-file">
                  ✓ {selectedFile.name}
                </div>
              )}

              {extractedText && (
                <textarea
                  className="extracted-text"
                  value={extractedText}
                  onChange={(e) => {
                    setExtractedText(
                      e.target.value
                    );
                    setMessage(
                      e.target.value
                    );
                  }}
                />
              )}

            </div>
          )}

          {/* PEOPLE */}

          <div className="form-section">

            <div className="section-title">
              <b>
                {mode === "rewrite"
                  ? "02"
                  : "01"}
              </b>
              People
            </div>

            <div className="people-grid">

              <div className="field">

                <label>
                  Your name
                </label>

                <input
                  value={senderName}
                  onChange={(e) =>
                    setSenderName(
                      e.target.value
                    )
                  }
                  placeholder="e.g. Monisha Leena"
                />

              </div>

              <div className="field">

                <label>
                  Recipient
                </label>

                <input
                  value={recipientName}
                  onChange={(e) =>
                    setRecipientName(
                      e.target.value
                    )
                  }
                  placeholder="e.g. Dr. Kumar"
                />

              </div>

            </div>

          </div>

          {/* MESSAGE */}

          <div className="form-section">

            <div className="section-title">
              <b>
                {mode === "rewrite"
                  ? "03"
                  : "02"}
              </b>
              {mode === "rewrite"
                ? "Document text"
                : "Your message"}
            </div>

            <div className="message-input-box">

              <textarea
                value={message}
                onChange={(e) =>
                  setMessage(
                    e.target.value
                  )
                }
                placeholder="Write in English, Tamil or Tanglish..."
              />

              <button
                className={`voice-button ${
                  listening
                    ? "listening"
                    : ""
                }`}
                onClick={
                  startVoiceInput
                }
                type="button"
              >
                {listening
                  ? "■"
                  : "🎙"}
              </button>

            </div>

            <div className="voice-language">

              <label>
                Voice language
              </label>

              <select
                value={voiceLanguage}
                onChange={(e) =>
                  setVoiceLanguage(
                    e.target.value
                  )
                }
              >
                <option value="en-IN">
                  English / Tanglish
                </option>

                <option value="ta-IN">
                  Tamil
                </option>

                <option value="en-US">
                  English
                </option>
              </select>

            </div>

            {listening && (
              <div className="listening-text">
                ● Listening... speak naturally
              </div>
            )}

          </div>

          {/* TYPE */}

          <div className="form-section">

            <div className="section-title">
              <b>
                {mode === "rewrite"
                  ? "04"
                  : "03"}
              </b>
              Communication type
            </div>

            <div className="type-grid">

              {[
                [
                  "Email",
                  "✉",
                  "Professional email",
                ],
                [
                  "Letter",
                  "▤",
                  "Formal business letter",
                ],
                [
                  "Message",
                  "☏",
                  "Professional chat",
                ],
              ].map(
                ([
                  item,
                  icon,
                  description,
                ]) => (

                  <button
                    key={item}
                    type="button"
                    className={`type-card ${
                      type === item
                        ? "selected"
                        : ""
                    }`}
                    onClick={() =>
                      setType(item)
                    }
                  >

                    <div className="type-card-icon">
                      {icon}
                    </div>

                    <div>
                      <strong>
                        {item}
                      </strong>

                      <small>
                        {description}
                      </small>
                    </div>

                    {type === item && (
                      <i>✓</i>
                    )}

                  </button>

                )
              )}

            </div>

          </div>

          {/* TONE */}

          <div className="form-section">

            <div className="section-title">
              <b>
                {mode === "rewrite"
                  ? "05"
                  : "04"}
              </b>
              Tone
            </div>

            <div className="tone-grid">

              {[
                "Professional",
                "Polite",
                "Friendly",
                "Casual",
                "Formal",
                "Apologetic",
                "Appreciative",
                "Assertive",
              ].map((item) => (

                <button
                  key={item}
                  type="button"
                  className={
                    tone === item
                      ? "tone active"
                      : "tone"
                  }
                  onClick={() =>
                    setTone(item)
                  }
                >
                  {item}
                </button>

              ))}

            </div>

          </div>

          {/* LENGTH */}

          <div className="form-section">

            <div className="section-title">
              <b>
                {mode === "rewrite"
                  ? "06"
                  : "05"}
              </b>
              Length
            </div>

            <div className="length-grid">

              {[
                "Short",
                "Medium",
                "Detailed",
              ].map((item) => (

                <button
                  key={item}
                  type="button"
                  className={
                    length === item
                      ? "length active"
                      : "length"
                  }
                  onClick={() =>
                    setLength(item)
                  }
                >
                  {item}
                </button>

              ))}

            </div>

          </div>

          {/* ACTION */}

          <button
            className="generate"
            type="button"
            disabled={loading}
            onClick={
              mode === "create"
                ? generateMessage
                : rewriteUploadedFile
            }
          >

            {loading ? (
              <>
                <span className="loading-spinner"></span>
                {mode === "create"
                  ? "Creating..."
                  : "Rewriting..."}
              </>
            ) : (
              <>
                ✦{" "}
                {mode === "create"
                  ? `Generate ${type}`
                  : `Rewrite ${type}`}
              </>
            )}

          </button>

        </section>

        {/* =========================
            RIGHT PREVIEW
        ========================= */}

        <section className="preview">

          <div className="preview-header">

            <div>

              <span>
                PREVIEW
              </span>

              <h2>
                {type === "Letter"
                  ? "Professional Letter"
                  : type === "Email"
                  ? "Professional Email"
                  : "Professional Message"}
              </h2>

            </div>

            <div className="preview-buttons">

              <button
                onClick={
                  copyDocument
                }
                type="button"
              >
                <span>⧉</span>
                Copy
              </button>

              <button
                onClick={
                  printDocument
                }
                type="button"
              >
                <span>⎙</span>
                Print
              </button>

            </div>

          </div>

          <div className="preview-window">

            <div className="browser-bar">

              <div className="browser-dots">

                <span></span>
                <span></span>
                <span></span>

              </div>

              <div className="browser-title">
                {type}
              </div>

            </div>

            <div className="preview-area">

              {type === "Letter" &&
                renderLetter()}

              {type === "Email" &&
                renderEmail()}

              {type === "Message" &&
                renderMessage()}

            </div>

          </div>

          {result && (
            <div className="preview-footer">

              <span>
                <i></i>
                Generated with Llama 3.2
              </span>

              <button
                onClick={
                  mode === "create"
                    ? generateMessage
                    : rewriteUploadedFile
                }
                type="button"
              >
                ↻ Generate again
              </button>

            </div>
          )}

        </section>

      </main>

      <footer>
        <strong>
          ToneWrite
        </strong>

        <span>
          AI-powered communication,
          made simple.
        </span>
      </footer>

    </div>
  );
}

export default App;