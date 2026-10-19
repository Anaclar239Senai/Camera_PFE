
"use strict";

const $ = (selector) => document.querySelector(selector);

const video = $("#video");
const toggleCameraButton = $("#toggleCamera");
const toggleCameraText = $("#toggleCameraText");
const captureButton = $("#captureButton");
const cameraStatus = $("#cameraStatus");
const cameraMessage = $("#cameraMessage");
const videoPlaceholder = $("#videoPlaceholder");
const liveLabel = $("#liveLabel");

const photoLabelInput = $("#photoLabel");
const filterButtons = document.querySelectorAll(".filter-option");

const processingCanvas = $("#processingCanvas");
const processingContext = processingCanvas.getContext("2d");

const photoCanvas = $("#photoCanvas");
const photoContext = photoCanvas.getContext("2d");

const emptyResult = $("#emptyResult");
const resultContent = $("#resultContent");
const resultBadge = $("#resultBadge");
const captureDate = $("#captureDate");
const captureFilter = $("#captureFilter");
const downloadButton = $("#downloadButton");

const themeToggle = $("#themeToggle");
const themeIcon = $("#themeIcon");
const themeText = $("#themeText");

let cameraStream = null;
let selectedFilter = "normal";
let latestCaptureDate = null;

const filterNames = {
    normal: "Estilo original",
    mono: "Preto e branco",
    warm: "Efeito quente",
    vintage: "Efeito vintage"
};

const filterValues = {
    normal: "none",
    mono: "grayscale(1)",
    warm: "sepia(.18) saturate(1.25) hue-rotate(-8deg)",
    vintage: "sepia(.55) contrast(.92) saturate(.8)"
};

/* Exibe mensagens para a pessoa usuária */

function showMessage(message, type = "normal") {
    cameraMessage.textContent = message;

    cameraMessage.classList.remove(
        "message-error",
        "message-success"
    );

    if (type === "error") {
        cameraMessage.classList.add("message-error");
    }

    if (type === "success") {
        cameraMessage.classList.add("message-success");
    }
}

/* Atualiza a aparência do painel da câmera */

function updateCameraStatus(active) {
    cameraStatus.classList.toggle("status-on", active);
    cameraStatus.classList.toggle("status-off", !active);

    cameraStatus.innerHTML = `
        <span class="status-dot"></span>
        ${active ? "Câmera ativa" : "Câmera desligada"}
    `;

    toggleCameraText.textContent = active
        ? "Desligar câmera"
        : "Ligar câmera";

    video.classList.toggle("active", active);
    videoPlaceholder.hidden = active;
    liveLabel.hidden = !active;
    captureButton.disabled = !active;
}

/* Liga a câmera */

async function startCamera() {
    if (cameraStream || toggleCameraButton.disabled) {
        return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
        showMessage(
            "Não foi possível acessar a câmera. Abra o projeto pelo Live Server ou HTTPS.",
            "error"
        );
        return;
    }

    toggleCameraButton.disabled = true;
    showMessage("Solicitando permissão para acessar a câmera...");

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                facingMode: "user",
                width: { ideal: 1280 },
                height: { ideal: 800 }
            }
        });

        cameraStream = stream;
        video.srcObject = stream;

        await video.play();

        stream.getTracks().forEach((track) => {
            track.addEventListener("ended", () => {
                if (cameraStream === stream) {
                    stopCamera(
                        "A câmera foi interrompida. Você pode ligá-la novamente."
                    );
                }
            }, { once: true });
        });

        updateCameraStatus(true);

        showMessage(
            "Câmera ativa! Escolha um efeito e capture sua fotografia.",
            "success"
        );
    } catch (error) {
        cameraStream?.getTracks().forEach((track) => track.stop());

        cameraStream = null;
        video.srcObject = null;

        updateCameraStatus(false);

        const messages = {
            NotAllowedError:
                "A permissão foi negada. Permita o acesso à câmera nas configurações do navegador.",
            PermissionDeniedError:
                "A permissão foi negada. Permita o acesso à câmera nas configurações do navegador.",
            NotFoundError:
                "Nenhuma câmera foi encontrada. Verifique se existe uma câmera conectada.",
            NotReadableError:
                "A câmera está sendo usada por outro aplicativo. Feche-o e tente novamente.",
            OverconstrainedError:
                "A câmera não atende às configurações solicitadas. Verifique o dispositivo."
        };

        showMessage(
            messages[error.name] ||
            "Não foi possível iniciar a câmera. Confira as permissões e tente novamente.",
            "error"
        );
    } finally {
        toggleCameraButton.disabled = false;
    }
}

/* Desliga a câmera */

function stopCamera(
    message = "Câmera desligada. Você pode ligá-la novamente quando quiser."
) {
    const stream = cameraStream;
    cameraStream = null;

    stream?.getTracks().forEach((track) => track.stop());

    video.pause();
    video.srcObject = null;

    updateCameraStatus(false);
    showMessage(message);
}

toggleCameraButton.addEventListener("click", () => {
    if (cameraStream) {
        stopCamera();
    } else {
        startCamera();
    }
});

/* Seleção dos filtros */

filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
        const filter = button.dataset.filter;

        if (!Object.hasOwn(filterValues, filter)) {
            return;
        }

        selectedFilter = filter;

        filterButtons.forEach((item) => {
            const active = item === button;

            item.classList.toggle("active", active);
            item.setAttribute("aria-pressed", String(active));
        });

        showMessage(
            `Efeito selecionado: ${filterNames[selectedFilter]}. O filtro será aplicado na próxima captura.`
        );
    });
});

/* Captura e processamento da fotografia */

captureButton.addEventListener("click", () => {
    if (
        !cameraStream ||
        !video.srcObject ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        !video.videoWidth ||
        !video.videoHeight
    ) {
        showMessage(
            "Ligue a câmera e aguarde a imagem aparecer antes de capturar.",
            "error"
        );
        return;
    }

    try {
        const width = video.videoWidth;
        const height = video.videoHeight;

        processingCanvas.width = width;
        processingCanvas.height = height;

        processingContext.clearRect(0, 0, width, height);

        processingContext.save();
        processingContext.filter = filterValues[selectedFilter];

        // Espelha a foto para combinar com a pré-visualização.
        processingContext.translate(width, 0);
        processingContext.scale(-1, 1);

        processingContext.drawImage(video, 0, 0, width, height);
        processingContext.restore();

        latestCaptureDate = new Date();

        composePhoto(width, height, latestCaptureDate);

        emptyResult.hidden = true;
        resultContent.hidden = false;

        resultBadge.textContent = "Captura concluída";
        resultBadge.classList.add("has-result");

        captureDate.textContent = formatDateTime(latestCaptureDate);
        captureFilter.textContent = filterNames[selectedFilter];

        showMessage(
            "Fotografia processada com sucesso! Você pode salvá-la ou capturar outra.",
            "success"
        );
    } catch (error) {
        console.error("Erro ao processar a fotografia:", error);

        showMessage(
            "Ocorreu um erro ao processar a imagem. Tente capturar novamente.",
            "error"
        );
    }
});

/* Adiciona identificação, data e horário na imagem */

function composePhoto(width, height, date) {
    photoCanvas.width = width;
    photoCanvas.height = height;

    photoContext.clearRect(0, 0, width, height);
    photoContext.drawImage(processingCanvas, 0, 0, width, height);

    const scale = width / 900;
    const padding = Math.max(20, 30 * scale);
    const panelHeight = Math.max(94 * scale, 86);
    const panelY = height - panelHeight;

    const gradient = photoContext.createLinearGradient(
        0,
        panelY - 20 * scale,
        0,
        height
    );

    gradient.addColorStop(0, "rgba(16, 18, 15, 0)");
    gradient.addColorStop(0.2, "rgba(45, 15, 31, 0.72)");
    gradient.addColorStop(1, "rgba(45, 15, 31, 0.9)");

    photoContext.fillStyle = gradient;
    photoContext.fillRect(
        0,
        panelY - 20 * scale,
        width,
        panelHeight + 20 * scale
    );

    const label = photoLabelInput.value.trim() || "Um momento especial";

    const labelFont = Math.max(20, 31 * scale);
    const dateFont = Math.max(12, 16 * scale);

    photoContext.textAlign = "left";
    photoContext.textBaseline = "alphabetic";

    photoContext.fillStyle = "#f7a9ca";
    photoContext.font = `700 ${Math.max(10, 12 * scale)}px Arial, sans-serif`;

    photoContext.fillText(
        "FRAME / REGISTRO",
        padding,
        height - panelHeight + 13 * scale
    );

    photoContext.fillStyle = "#ffffff";
    photoContext.font = `700 ${labelFont}px Arial, sans-serif`;

    photoContext.fillText(
        fitText(label, width - padding * 2, photoContext),
        padding,
        height - panelHeight + 48 * scale
    );

    photoContext.fillStyle = "rgba(255, 255, 255, 0.88)";
    photoContext.font = `400 ${dateFont}px Arial, sans-serif`;

    photoContext.fillText(
        formatDateTime(date),
        padding,
        height - padding * 0.55
    );
}

/* Evita que o texto ultrapasse a largura da imagem */

function fitText(text, maxWidth, context) {
    if (context.measureText(text).width <= maxWidth) {
        return text;
    }

    let shortened = text;

    while (
        shortened.length > 1 &&
        context.measureText(shortened + "…").width > maxWidth
    ) {
        shortened = shortened.slice(0, -1);
    }

    return shortened + "…";
}

/* Formata a data e a hora em português */

function formatDateTime(date) {
    return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    }).format(date);
}

/* Baixa a fotografia em PNG */

downloadButton.addEventListener("click", () => {
    if (!latestCaptureDate || !photoCanvas.width) {
        showMessage(
            "Capture uma fotografia antes de tentar salvá-la.",
            "error"
        );
        return;
    }

    downloadButton.disabled = true;

    photoCanvas.toBlob((blob) => {
        downloadButton.disabled = false;

        if (!blob) {
            showMessage(
                "Não foi possível gerar o arquivo. Capture a foto novamente.",
                "error"
            );
            return;
        }

        const url = URL.createObjectURL(blob);
        const timestamp = latestCaptureDate
            .toISOString()
            .replace(/[:.]/g, "-");

        const link = document.createElement("a");

        link.href = url;
        link.download = `frame-captura-${timestamp}.png`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);

        showMessage(
            "Download iniciado! Sua fotografia foi preparada em PNG.",
            "success"
        );
    }, "image/png");
});

/* Modo claro e modo escuro */

function setTheme(theme) {
    const dark = theme === "dark";

    document.documentElement.dataset.theme = dark
        ? "dark"
        : "light";

    themeIcon.textContent = dark ? "☀" : "☾";
    themeText.textContent = dark ? "Modo claro" : "Modo escuro";

    themeToggle.setAttribute(
        "aria-label",
        dark ? "Ativar modo claro" : "Ativar modo escuro"
    );

    themeToggle.setAttribute("aria-pressed", String(dark));
}

themeToggle.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme || "light";
    const next = current === "light" ? "dark" : "light";

    setTheme(next);

    try {
        localStorage.setItem("frame-theme", next);
    } catch (error) {
        // O tema continua funcionando mesmo se o navegador bloquear o armazenamento.
    }
});

/* Carrega o tema salvo, se existir */

try {
    const savedTheme = localStorage.getItem("frame-theme");

    setTheme(savedTheme === "dark" ? "dark" : "light");
} catch (error) {
    setTheme("light");
}

/* Encerra a câmera ao sair da página */

window.addEventListener("pagehide", () => {
    cameraStream?.getTracks().forEach((track) => track.stop());
});
