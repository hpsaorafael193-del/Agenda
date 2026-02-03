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
const alertContainer = document.getElementById("alert-container");
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
const DOCTOR_NAME = (doctor) =>
  doctor === "natalie" ? "Dra. Natalie Bianchi" : "Dra. Anne D'Luddhiev";

const BIRTH_TYPE_NAMES = {
  normal: "Parto Normal",
  humanizado: "Parto Humanizado",
  agendado: "Parto Agendado",
};

// CONFIGURAÇÕES INICIAIS
const today = new Date();
const formattedToday = today.toISOString().split("T")[0];
birthDateInput.min = formattedToday;
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

// ✅ NÃO usar addEventListener fixo aqui!
// O comportamento do btnConfirmAppointment é definido dinamicamente
// (criar x concluir x fechar)

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
loadAppointments(); // carrega do Supabase e re-renderiza

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

// SUPABASE: LOAD
async function loadAppointments() {
  const { data, error } = await supabaseClient
    .from("appointments")
    .select("*")
    .order("datetime", { ascending: true });

  if (error) {
    if (
      error.message?.includes("no_doctor_overlap_5h") ||
      error.code === "23P01"
    ) {
      showAlert(
        "Conflito de horário: já existe um agendamento para este médico com menos de 5 horas.",
        "error",
      );
    } else {
      showAlert("Erro ao salvar agendamento.", "error");
    }
    return;
  }

  // Blindagem + normalização para manter seu código estável
  appointments = (data || [])
    .filter((app) => app && app.id && app.date && app.time && app.doctor)
    .map((app) => ({
      ...app,
      // garantir consistência: datetime pode vir string
      datetime: app.datetime ? new Date(app.datetime).getTime() : null,
    }));

  renderCalendar();
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

  // Validar se a data é no futuro
  if (appointmentDate < new Date()) {
    showAlert("Não é possível agendar para datas/horários passados!", "error");
    return;
  }

  // Validar conflitos de horário (5h)
  const conflicts = checkForConflicts(selectedDoctor, appointmentDate, null);
  if (conflicts.length > 0) {
    showAlert(
      "Conflito de horário! Já existe um parto agendado para este médico com menos de 5 horas de diferença.",
      "error",
    );
    return;
  }

  // Objeto no formato do banco (snake_case)
  currentAppointment = {
    patient_name: patientNameInput.value.trim(),
    patient_phone: patientPhoneInput.value.trim(),
    birth_type: birthTypeSelect.value,
    doctor: selectedDoctor,
    date: birthDateInput.value, // yyyy-mm-dd
    time: birthTimeInput.value, // HH:mm
    datetime: appointmentDate.toISOString(), // timestamp
    notes: notesInput.value.trim() || null,
    status: "agendado",
  };

  // Mostrar modal de confirmação (modo CRIAR)
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
            <div class="detail-value">${BIRTH_TYPE_NAMES[appointment.birth_type] || appointment.birth_type}</div>
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

  // ✅ Aqui o botão confirma INSERE no Supabase
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
    showAlert("Erro ao salvar agendamento (Supabase).", "error");
    return;
  }

  confirmationModal.style.display = "none";
  showAlert("Parto agendado com sucesso!", "success");
  clearForm();
  await loadAppointments();
}

// CONCLUIR AGENDAMENTO
async function concludeAppointment(appointmentId) {
  if (!appointmentId) return;

  // Se já estiver concluído, só fecha (UX)
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

  if (!confirm("Tem certeza que deseja cancelar este agendamento?")) return;

  const { error } = await supabaseClient
    .from("appointments")
    .delete()
    .eq("id", appointmentId);

  if (error) {
    showAlert("Erro ao cancelar agendamento (Supabase).", "error");
    return;
  }

  confirmationModal.style.display = "none";
  showAlert("Agendamento cancelado com sucesso!", "success");
  await loadAppointments();
}

// CONFLITOS (5h)
function checkForConflicts(doctor, appointmentDate, appointmentId) {
  const FIVE_HOURS = 5 * 60 * 60 * 1000;

  return appointments.filter((app) => {
    if (!app) return false;
    if (appointmentId && app.id === appointmentId) return false;
    if (app.doctor !== doctor) return false;

    // datetime no array já está em ms
    if (!app.datetime) return false;

    const timeDiff = Math.abs(appointmentDate.getTime() - app.datetime);
    return timeDiff < FIVE_HOURS;
  });
}

// RENDER CALENDÁRIO (original completo)
function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Atualizar título do mês
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

  // Obter primeiro e último dia do mês
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Obter dia da semana do primeiro dia (0 = Domingo)
  let firstDayIndex = firstDay.getDay();
  // Ajustar para semana começar na segunda-feira (0 = Segunda)
  firstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  // Limpar calendário
  calendarElement.innerHTML = "";

  // Cabeçalho dos dias
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

  // Corpo do calendário
  const calendarBody = document.createElement("div");
  calendarBody.className = "calendar-body";

  // Células vazias do mês anterior
  for (let i = 0; i < firstDayIndex; i++) {
    const emptyDay = document.createElement("div");
    emptyDay.className = "calendar-day day-disabled";
    calendarBody.appendChild(emptyDay);
  }

  // Dias do mês atual
  const today = new Date();
  const isCurrentMonth =
    today.getMonth() === month && today.getFullYear() === year;

  for (let day = 1; day <= daysInMonth; day++) {
    const dayElement = document.createElement("div");
    dayElement.className = "calendar-day";

    if (isCurrentMonth && day === today.getDate()) {
      dayElement.classList.add("day-today");
    }

    const dayNumber = document.createElement("div");
    dayNumber.className = "day-number";
    dayNumber.textContent = day;
    dayElement.appendChild(dayNumber);

    const dayAppointments = document.createElement("div");
    dayAppointments.className = "day-appointments";

    const currentDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    // ✅ blindagem contra lixo
    const dayAppts = appointments.filter(
      (app) => app && app.date === currentDateStr,
    );

    // Ordenar por horário
    dayAppts.sort((a, b) => (a.time || "").localeCompare(b.time || ""));

    dayAppts.forEach((app) => {
      const appointmentElement = document.createElement("div");

      const statusClass = app.status === "concluido" ? "appointment-done" : "";
      appointmentElement.className =
        `appointment appointment-${app.doctor} ${statusClass}`.trim();
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

// DETALHES DO AGENDAMENTO (modal) - original completo
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
                <div class="detail-value">${BIRTH_TYPE_NAMES[appointment.birth_type] || appointment.birth_type}</div>
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
                <div class="detail-value">${appointment.status === "agendado" ? "Agendado" : "Concluído"}</div>
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

  // ✅ Aqui é a correção do bug:
  // Ao abrir agendamento existente, o botão NÃO cria outro.
  // Se estiver agendado -> conclui
  // Se já estiver concluído -> vira OK e fecha
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
  birthTypeSelect.value = "normal";
  doctorOptions.forEach((opt) => opt.classList.remove("selected"));
  selectedDoctor = null;
  notesInput.value = "";

  // Resetar data para hoje
  birthDateInput.value = formattedToday;
  birthTimeInput.value = "08:00";

  validateForm();
}

// ALERTA
function showAlert(message, type) {
  alertContainer.innerHTML = `
        <div class="alert alert-${type}">
            <i class="fas fa-${type === "success" ? "check-circle" : type === "error" ? "exclamation-circle" : "exclamation-triangle"}"></i>
            ${message}
        </div>
    `;

  setTimeout(() => {
    alertContainer.innerHTML = "";
  }, 5000);
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
