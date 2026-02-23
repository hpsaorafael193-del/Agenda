// SUPABASE CONFIG
const SUPABASE_URL = "https://kygvunkvbnpzplxdpvhq.supabase.co";
const SUPABASE_KEY = "sb_publishable_5nig_0z1i1TbZB38KgH-DQ_TTjVPCXB";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ESTADO DA APLICAÇÃO
let appointments = []; // vem do Supabase
let currentDate = new Date();
let selectedDoctor = null;
let currentAppointment = null;

// ELEMENTOS DOM
const patientNameInput = document.getElementById("patient-name");
const patientPhoneInput = document.getElementById("patient-phone");
const birthTypeSelect = document.getElementById("birth-type");
const birthDateInput = document.getElementById("birth-date");
const birthTimeInput = document.getElementById("birth-time");
const notesInput = document.getElementById("notes");
const btnSchedule = document.getElementById("btn-schedule");
const doctorOptions = document.querySelectorAll(".doctor-option");
const calendarElement = document.getElementById("calendar");
const currentMonthElement = document.getElementById("current-month");
const btnPrevMonth = document.getElementById("btn-prev-month");
const btnNextMonth = document.getElementById("btn-next-month");
const confirmationModal = document.getElementById("confirmation-modal");
const btnCloseModal = document.getElementById("btn-close-modal");
const btnConfirmAppointment = document.getElementById(
  "btn-confirm-appointment",
);
const btnCancelAppointment = document.getElementById("btn-cancel-appointment");
const modalDetails = document.getElementById("modal-details");

// CONSTANTES / MAPAS
const DOCTORS = {
  anne: "Dra. Anne D'Luddhiev",
  natalie: "Dra. Natalie Bianchi",
  igor: "Dr. Igor Luddhiev",
  luan: "Dr. Luan D'Amato",
  lia: "Dra. Lia Vespucci",
};

function normalizeDoctor(raw) {
  if (!raw) return null;
  const v = String(raw).trim().toLowerCase();

  if (DOCTORS[v]) return v;

  if (v.includes("anne")) return "anne";
  if (v.includes("natalie")) return "natalie";
  if (v.includes("igor")) return "igor";
  if (v.includes("luan")) return "luan";
  if (v.includes("lia")) return "lia";

  return v.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

const DOCTOR_NAME = (doctor) => {
  const key = normalizeDoctor(doctor);
  return DOCTORS[key] || String(doctor);
};

// Tipo de consulta (sem teleconsulta)
const CONSULT_TYPE_NAMES = {
  consulta: "Consulta",
  retorno: "Retorno",
  procedimento: "Procedimento",
  parto: "Parto", // compatibilidade com registros antigos
};

// REGRAS DE INTERVALO (GLOBAL, independente do médico)
function isProcedureType(type) {
  const t = String(type || "").toLowerCase();
  // compatibilidade: se ainda existir "parto" no banco, trate como procedimento (4h apenas com procedimento)
  return t === "procedimento" || t === "parto";
}

function getRequiredIntervalMs(newType, existingType) {
  const newIsProc = isProcedureType(newType);
  const oldIsProc = isProcedureType(existingType);

  // Só exige 4h quando os DOIS são procedimento/parto
  if (newIsProc && oldIsProc) return 4 * 60 * 60 * 1000;

  // Qualquer combinação com consulta/retorno => 2h
  return 2 * 60 * 60 * 1000;
}

// CONFIGURAÇÕES INICIAIS
const today = new Date();
const formattedToday = today.toISOString().split("T")[0];
birthDateInput.min = formattedToday;
birthDateInput.value = formattedToday;
birthTimeInput.value = "08:00";

// Seleção de médico
doctorOptions.forEach((option) => {
  option.addEventListener("click", () => {
    doctorOptions.forEach((opt) => opt.classList.remove("selected"));
    option.classList.add("selected");
    selectedDoctor = option.getAttribute("data-doctor");
    validateForm();
  });
});

// Agendamento
btnSchedule.addEventListener("click", scheduleAppointment);

// Navegação calendário
btnPrevMonth.addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
});

btnNextMonth.addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
});

// Modal
btnCloseModal.addEventListener("click", () => {
  confirmationModal.style.display = "none";
});

btnCancelAppointment.addEventListener("click", () => {
  confirmationModal.style.display = "none";
});

// Validar formulário em tempo real
[patientNameInput, patientPhoneInput, birthDateInput, birthTimeInput].forEach(
  (input) => {
    input.addEventListener("input", validateForm);
  },
);

// Fechar modal ao clicar fora
window.addEventListener("click", (e) => {
  if (e.target === confirmationModal) {
    confirmationModal.style.display = "none";
  }
});

// Formatar telefone automaticamente (modelo atual: (055) 000-000)
patientPhoneInput.addEventListener("input", (e) => {
  let value = e.target.value.replace(/\D/g, "");
  value = value.substring(0, 9);

  if (value.length > 6) {
    value = value.replace(/^(\d{3})(\d{3})(\d{0,3})/, "($1) $2-$3");
  } else if (value.length > 3) {
    value = value.replace(/^(\d{3})(\d{0,3})/, "($1) $2");
  } else if (value.length > 0) {
    value = value.replace(/^(\d{0,3})/, "($1");
  }

  e.target.value = value;
});

// INIT
renderCalendar();
validateForm();
loadAppointments();

// FUNÇÕES
function validateForm() {
  const isFormValid =
    patientNameInput.value.trim() !== "" &&
    patientPhoneInput.value.trim() !== "" &&
    birthDateInput.value !== "" &&
    birthTimeInput.value !== "" &&
    selectedDoctor !== null;

  btnSchedule.disabled = !isFormValid;
  return isFormValid;
}

/**
 * LOAD APPOINTMENTS
 * - ordena por date+time (evita depender de "datetime" no banco)
 * - gera datetime_ms no front para facilitar cálculos
 * - normaliza doctor
 */
async function loadAppointments() {
  const { data, error } = await supabaseClient
    .from("appointments")
    .select(
      "id,patient_name,patient_phone,birth_type,doctor,date,time,notes,status,datetime",
    )
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (error) {
    console.error("Erro ao carregar appointments:", error);
    showAlert(
      `Erro ao carregar agendamentos: ${error.message || "desconhecido"}`,
      "error",
    );
    return;
  }

  appointments = (data || [])
    .filter((app) => app && app.id && app.date && app.time && app.doctor)
    .map((app) => {
      const doctorKey = normalizeDoctor(app.doctor);
      const dt = new Date(`${app.date}T${app.time}`);
      return {
        ...app,
        doctor: doctorKey,
        datetime_ms: Number.isNaN(dt.getTime()) ? null : dt.getTime(),
      };
    });

  renderCalendar();
}

// CONFLITOS (GLOBAL, independente do médico)
function checkForConflicts(appointmentDate, appointmentId, newType) {
  return appointments.filter((app) => {
    if (!app) return false;
    if (appointmentId && app.id === appointmentId) return false;

    let existingMs = app.datetime_ms;
    if (!existingMs && app.date && app.time) {
      const d = new Date(`${app.date}T${app.time}`);
      existingMs = Number.isNaN(d.getTime()) ? null : d.getTime();
    }
    if (!existingMs) return false;

    const requiredMs = getRequiredIntervalMs(newType, app.birth_type);
    const diff = Math.abs(appointmentDate.getTime() - existingMs);
    return diff < requiredMs;
  });
}

// CRIAR AGENDAMENTO
function scheduleAppointment() {
  if (!validateForm()) {
    showAlert("Preencha todos os campos obrigatórios!", "error");
    return;
  }

  const appointmentDate = new Date(
    `${birthDateInput.value}T${birthTimeInput.value}`,
  );

  if (appointmentDate < new Date()) {
    showAlert("Não é possível agendar para datas/horários passados!", "error");
    return;
  }

  const newType = birthTypeSelect.value;
  const conflicts = checkForConflicts(appointmentDate, null, newType);

  if (conflicts.length > 0) {
    showAlert(
      "Conflito de horário: intervalo mínimo — Consultas/Retornos: 2h | Partos/Procedimentos: 4h.",
      "error",
    );
    return;
  }

  currentAppointment = {
    patient_name: patientNameInput.value.trim(),
    patient_phone: patientPhoneInput.value.trim(),
    birth_type: birthTypeSelect.value,
    doctor: normalizeDoctor(selectedDoctor),
    date: birthDateInput.value,
    time: birthTimeInput.value,
    // Se a coluna datetime existir no banco, pode manter. Se não existir, remova.
    datetime: appointmentDate.toISOString(),
    notes: notesInput.value.trim() || null,
    status: "agendado",
  };

  showConfirmationModal(currentAppointment);
}

function showConfirmationModal(appointment) {
  modalDetails.innerHTML = `
        <div class="detail-row">
            <div class="detail-label">Paciente:</div>
            <div class="detail-value">${appointment.patient_name}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Telefone:</div>
            <div class="detail-value">${appointment.patient_phone}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Médico:</div>
            <div class="detail-value">${DOCTOR_NAME(appointment.doctor)}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Data:</div>
            <div class="detail-value">${formatDate(appointment.date)}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Horário:</div>
            <div class="detail-value">${appointment.time}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Tipo:</div>
            <div class="detail-value">${
              CONSULT_TYPE_NAMES[appointment.birth_type] ||
              appointment.birth_type
            }</div>
        </div>
        ${
          appointment.notes
            ? `
        <div class="detail-row">
            <div class="detail-label">Observações:</div>
            <div class="detail-value">${appointment.notes}</div>
        </div>
        `
            : ""
        }
    `;

  const modalTitle = document.querySelector(".modal-title");
  if (modalTitle) {
    modalTitle.innerHTML =
      '<i class="fas fa-calendar-check"></i> Confirmar Agendamento';
  }

  btnConfirmAppointment.textContent = "Confirmar";
  btnConfirmAppointment.onclick = confirmAppointment;

  confirmationModal.style.display = "flex";
}

async function confirmAppointment() {
  if (!currentAppointment) {
    confirmationModal.style.display = "none";
    return;
  }

  const { error } = await supabaseClient
    .from("appointments")
    .insert([currentAppointment]);

  if (error) {
    console.error("Erro ao inserir appointment:", error);
    showAlert(`Erro ao salvar agendamento: ${error.message}`, "error");
    return;
  }

  confirmationModal.style.display = "none";
  showAlert("Consulta agendada com sucesso!", "success");
  clearForm();
  await loadAppointments();
}

// CONCLUIR AGENDAMENTO
async function concludeAppointment(appointmentId) {
  if (!appointmentId) return;

  const local = appointments.find((a) => a && a.id === appointmentId);
  if (local && local.status === "concluido") {
    confirmationModal.style.display = "none";
    return;
  }

  const { error } = await supabaseClient
    .from("appointments")
    .update({ status: "concluido" })
    .eq("id", appointmentId);

  if (error) {
    console.error("Erro ao concluir:", error);
    showAlert("Erro ao concluir agendamento (Supabase).", "error");
    return;
  }

  confirmationModal.style.display = "none";
  showAlert("Agendamento marcado como concluído!", "success");
  await loadAppointments();
}

// CANCELAR (DELETE)
async function deleteAppointment(appointmentId) {
  if (!appointmentId) return;

  const appointment = appointments.find((a) => a && a.id === appointmentId);
  if (!appointment) return;

  showActionConfirmModal({
    title: "Confirmar cancelamento",
    confirmText: "Sim, cancelar",
    cancelText: "Voltar",
    html: `
      <div class="appointment-details">
        <div class="detail-row">
          <div class="detail-label">Paciente:</div>
          <div class="detail-value">${appointment.patient_name}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Médico:</div>
          <div class="detail-value">${DOCTOR_NAME(appointment.doctor)}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Data:</div>
          <div class="detail-value">${formatDate(appointment.date)}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Horário:</div>
          <div class="detail-value">${appointment.time}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Tipo:</div>
          <div class="detail-value">${CONSULT_TYPE_NAMES[appointment.birth_type] || appointment.birth_type}</div>
        </div>
      </div>
      <div style="margin-top:12px; font-weight:600; color:#491100;">
        Tem certeza que deseja cancelar este agendamento?
      </div>
    `,
    onConfirm: async () => {
      const { error } = await supabaseClient
        .from("appointments")
        .delete()
        .eq("id", appointmentId);

      if (error) {
        console.error("Erro ao deletar:", error);
        showAlert("Erro ao cancelar agendamento (Supabase).", "error");
        return;
      }

      confirmationModal.style.display = "none";
      showAlert("Agendamento cancelado com sucesso!", "success");
      await loadAppointments();
    },
  });
}

// RENDER CALENDÁRIO
function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  currentMonthElement.textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  let firstDayIndex = firstDay.getDay();
  firstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  calendarElement.innerHTML = "";

  const dayNames = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const calendarHeader = document.createElement("div");
  calendarHeader.className = "calendar-header";

  dayNames.forEach((day) => {
    const headerCell = document.createElement("div");
    headerCell.className = "calendar-header-cell";
    headerCell.textContent = day;
    calendarHeader.appendChild(headerCell);
  });

  calendarElement.appendChild(calendarHeader);

  const calendarBody = document.createElement("div");
  calendarBody.className = "calendar-body";

  for (let i = 0; i < firstDayIndex; i++) {
    const emptyDay = document.createElement("div");
    emptyDay.className = "calendar-day day-disabled";
    calendarBody.appendChild(emptyDay);
  }

  const todayLocal = new Date();
  const isCurrentMonth =
    todayLocal.getMonth() === month && todayLocal.getFullYear() === year;

  for (let day = 1; day <= daysInMonth; day++) {
    const dayElement = document.createElement("div");
    dayElement.className = "calendar-day";

    if (isCurrentMonth && day === todayLocal.getDate()) {
      dayElement.classList.add("day-today");
    }

    const dayNumber = document.createElement("div");
    dayNumber.className = "day-number";
    dayNumber.textContent = day;
    dayElement.appendChild(dayNumber);

    const dayAppointments = document.createElement("div");
    dayAppointments.className = "day-appointments";

    const currentDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const dayAppts = appointments.filter(
      (app) => app && app.date === currentDateStr,
    );

    dayAppts.sort((a, b) => (a.time || "").localeCompare(b.time || ""));

    dayAppts.forEach((app) => {
      const appointmentElement = document.createElement("div");

      const statusClass = app.status === "concluido" ? "appointment-done" : "";
      const doctorKey = normalizeDoctor(app.doctor);
      appointmentElement.className =
        `appointment appointment-${doctorKey} ${statusClass}`.trim();
      appointmentElement.setAttribute("data-appointment-id", app.id);

      appointmentElement.innerHTML = `
                <div class="appointment-time">${app.time}</div>
                <div class="appointment-patient">${(app.patient_name || "").split(" ")[0]}</div>
            `;

      appointmentElement.addEventListener("click", (e) => {
        e.stopPropagation();
        showAppointmentDetails(app.id);
      });

      dayAppointments.appendChild(appointmentElement);
    });

    dayElement.appendChild(dayAppointments);
    calendarBody.appendChild(dayElement);
  }

  calendarElement.appendChild(calendarBody);
}

// DETALHES DO AGENDAMENTO (modal)
function showAppointmentDetails(appointmentId) {
  const appointment = appointments.find(
    (app) => app && app.id === appointmentId,
  );
  if (!appointment) return;

  const details = `
        <div class="appointment-details">
            <div class="detail-row">
                <div class="detail-label">Paciente:</div>
                <div class="detail-value">${appointment.patient_name}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Telefone:</div>
                <div class="detail-value">${appointment.patient_phone}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Médico:</div>
                <div class="detail-value">${DOCTOR_NAME(appointment.doctor)}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Data:</div>
                <div class="detail-value">${formatDate(appointment.date)}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Horário:</div>
                <div class="detail-value">${appointment.time}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Tipo:</div>
                <div class="detail-value">${CONSULT_TYPE_NAMES[appointment.birth_type] || appointment.birth_type}</div>
            </div>
            ${
              appointment.notes
                ? `
            <div class="detail-row">
                <div class="detail-label">Observações:</div>
                <div class="detail-value">${appointment.notes}</div>
            </div>
            `
                : ""
            }
            <div class="detail-row">
                <div class="detail-label">Status:</div>
                <div class="detail-value">${
                  appointment.status === "agendado" ? "Agendado" : "Concluído"
                }</div>
            </div>
        </div>
        <div class="modal-buttons">
            <button class="btn-cancel" onclick="deleteAppointment('${appointment.id}')">
                <i class="fas fa-trash"></i> Cancelar Agendamento
            </button>
        </div>
    `;

  modalDetails.innerHTML = details;

  const modalTitle = document.querySelector(".modal-title");
  if (modalTitle) {
    modalTitle.innerHTML =
      '<i class="fas fa-calendar-alt"></i> Detalhes do Agendamento';
  }

  btnConfirmAppointment.textContent =
    appointment.status === "concluido" ? "OK" : "Concluir";
  btnConfirmAppointment.onclick = () => {
    if (appointment.status === "concluido") {
      confirmationModal.style.display = "none";
      return;
    }
    concludeAppointment(appointment.id);
  };

  confirmationModal.style.display = "flex";
}

// LIMPAR FORM
function clearForm() {
  patientNameInput.value = "";
  patientPhoneInput.value = "";
  birthTypeSelect.value = "consulta";
  doctorOptions.forEach((opt) => opt.classList.remove("selected"));
  selectedDoctor = null;
  notesInput.value = "";

  birthDateInput.value = formattedToday;
  birthTimeInput.value = "08:00";

  validateForm();
}

/**
 * ✅ POPUP (TOAST) NA TELA
 * Substitui o antigo alert em container fixo.
 */
function showAlert(message, type) {
  const TOAST_LIFETIME = 4500;

  let toastRoot = document.getElementById("toast-root");
  if (!toastRoot) {
    toastRoot = document.createElement("div");
    toastRoot.id = "toast-root";
    document.body.appendChild(toastRoot);
  }

  const titles = { success: "Sucesso", error: "Atenção", warning: "Aviso" };
  const icons = {
    success: `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"></path></svg>`,
    error: `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path></svg>`,
    warning: `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"></path></svg>`,
  };

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.dataset.type = type || "warning";

  toast.innerHTML = `
    <div class="icon">${icons[type] || icons.warning}</div>
    <div class="content">
      <div class="title">${titles[type] || titles.warning}</div>
      <div class="msg">${String(message || "")}</div>
    </div>
    <button class="close" type="button" aria-label="Fechar">×</button>
  `;

  const removeToast = () => {
    if (!toast.isConnected) return;
    toast.classList.add("out");
    toast.addEventListener("animationend", () => toast.remove(), {
      once: true,
    });
  };

  toast.querySelector(".close").addEventListener("click", removeToast);
  toastRoot.prepend(toast);
  window.setTimeout(removeToast, TOAST_LIFETIME);
}

// DATA
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function showActionConfirmModal({
  title = "Confirmar ação",
  html = "",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  onConfirm = () => {},
}) {
  modalDetails.innerHTML = html;

  const modalTitle = document.querySelector(".modal-title");
  if (modalTitle) {
    modalTitle.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${title}`;
  }

  // Botões
  btnConfirmAppointment.textContent = confirmText;
  btnCancelAppointment.textContent = cancelText;

  // Limpa handlers antigos e define novos
  btnConfirmAppointment.onclick = async () => {
    try {
      // trava para evitar duplo clique
      btnConfirmAppointment.disabled = true;
      await onConfirm();
    } finally {
      btnConfirmAppointment.disabled = false;
    }
  };

  btnCancelAppointment.onclick = () => {
    confirmationModal.style.display = "none";
  };

  // Garantir que o modal abre
  confirmationModal.style.display = "flex";
}
