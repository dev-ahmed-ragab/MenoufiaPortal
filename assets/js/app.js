/* ==========================================================================
   Menoufia Portal — application logic
   Demo-only: all data stays in the visitor's browser (localStorage).
   ========================================================================== */

(function () {
  'use strict';

  var CONFIG = {
    storageKey: 'mfw_requests_v1',
    adminKey: 'mfw_admin_session',
    adminPassword: 'admin123',
    maxFileSize: 8 * 1024 * 1024,
    maxRecords: 2000,
  };

  var STATUSES = ['قيد المراجعة', 'تم التواصل', 'مقبول', 'مرفوض'];
  var DEFAULT_SUBMIT_TEXT = 'حفظ طلب تجريبي على هذا الجهاز';

  var els = {};
  var currentRequestId = null;
  var lastFocusedElement = null;
  var toastTimer = null;
  var storageOK = true;
  var memoryRequests = [];
  var formDirty = false;
  var fileUrls = { personalPhoto: null, idCardPhoto: null };

  document.addEventListener('DOMContentLoaded', init);

  /* --------------------------------------------------------------------- */
  /* Boot                                                                   */
  /* --------------------------------------------------------------------- */

  function init() {
    cacheElements();
    if (!els.form) return;

    checkStorageAvailability();
    bindEvents();
    setFooterYear();
    updateNotesCount();
  }

  function cacheElements() {
    els.welcomeScreen = document.getElementById('welcomeScreen');
    els.registrationForm = document.getElementById('registrationFormContainer');
    els.successScreen = document.getElementById('successScreen');
    els.successTitle = document.getElementById('successTitle');
    els.successCard = document.getElementById('successCard');
    els.successRequestId = document.getElementById('successRequestId');

    els.form = document.getElementById('membershipForm');
    els.centerSelect = document.getElementById('centerSelect');
    els.fullName = document.getElementById('fullName');
    els.phone = document.getElementById('phone');
    els.village = document.getElementById('village');
    els.notes = document.getElementById('notes');
    els.notesCount = document.getElementById('notesCount');
    els.consent = document.getElementById('consent');
    els.submitBtn = document.getElementById('submitBtn');
    els.submitBtnText = document.getElementById('submitBtnText');
    els.formStatus = document.getElementById('formStatus');

    els.personalPhoto = document.getElementById('personalPhoto');
    els.personalPhotoPreview = document.getElementById('personalPhotoPreview');
    els.personalPhotoPreviewWrap = document.getElementById('personalPhotoPreviewWrap');
    els.idCardPhoto = document.getElementById('idCardPhoto');
    els.idCardPhotoPreview = document.getElementById('idCardPhotoPreview');
    els.idCardPhotoPreviewWrap = document.getElementById('idCardPhotoPreviewWrap');

    els.adminModal = document.getElementById('adminModal');
    els.adminLoginView = document.getElementById('adminLoginView');
    els.adminPanel = document.getElementById('adminPanel');
    els.adminLoginForm = document.getElementById('adminLoginForm');
    els.adminPassword = document.getElementById('adminPassword');
    els.adminLoginError = document.getElementById('adminLoginError');
    els.adminSearch = document.getElementById('adminSearch');
    els.adminList = document.getElementById('adminList');
    els.adminStorageWarning = document.getElementById('adminStorageWarning');
    els.statTotal = document.getElementById('statTotal');
    els.statToday = document.getElementById('statToday');
    els.statCenters = document.getElementById('statCenters');

    els.printArea = document.getElementById('printArea');
    els.toastBox = document.getElementById('toastBox');
    els.toastText = document.getElementById('toastText');
    els.footerYear = document.getElementById('footerYear');
  }

  function bindEvents() {
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleGlobalKeydown);

    els.form.addEventListener('submit', handleSubmit);
    els.form.addEventListener('input', markFormDirty);
    els.form.addEventListener('change', markFormDirty);

    els.phone.addEventListener('input', handlePhoneInput);
    els.phone.addEventListener('blur', handlePhoneBlur);
    els.fullName.addEventListener('input', function () {
      els.fullName.setCustomValidity('');
    });
    els.notes.addEventListener('input', updateNotesCount);

    els.personalPhoto.addEventListener('change', function () {
      handleFileChange('personalPhoto');
    });
    els.idCardPhoto.addEventListener('change', function () {
      handleFileChange('idCardPhoto');
    });

    els.adminLoginForm.addEventListener('submit', handleAdminLogin);
    els.adminPassword.addEventListener('input', function () {
      els.adminPassword.removeAttribute('aria-invalid');
      els.adminLoginError.hidden = true;
    });
    els.adminSearch.addEventListener('input', renderAdminList);
    els.adminList.addEventListener('click', handleAdminListClick);
    els.adminList.addEventListener('change', handleAdminListChange);

    window.addEventListener('storage', function (event) {
      if (event.key === CONFIG.storageKey && isAdminAuthed() && !els.adminModal.hidden) {
        renderAdminList();
      }
    });
  }

  /* --------------------------------------------------------------------- */
  /* Navigation                                                             */
  /* --------------------------------------------------------------------- */

  function handleDocumentClick(event) {
    var trigger = event.target.closest('[data-action]');
    if (!trigger) return;

    var action = trigger.getAttribute('data-action');

    switch (action) {
      case 'start-registration':
        event.preventDefault();
        startRegistration();
        break;
      case 'back-home':
      case 'go-home':
        event.preventDefault();
        goHome();
        break;
      case 'open-admin':
        event.preventDefault();
        openAdmin();
        break;
      case 'close-admin':
        closeAdmin();
        break;
      case 'new-request':
        startRegistration(true);
        break;
      case 'print-current':
        printCurrentRequest();
        break;
      case 'delete-current':
        deleteCurrentRequest();
        break;
      case 'clear-photo':
        clearPhoto(trigger.getAttribute('data-target'));
        break;
      case 'admin-logout':
        logoutAdmin();
        break;
      case 'export-csv':
        exportCSV();
        break;
      case 'clear-all':
        clearAllRequests();
        break;
      default:
        break;
    }
  }

  function showScreen(name) {
    els.welcomeScreen.hidden = name !== 'welcome';
    els.registrationForm.hidden = name !== 'form';
    els.successScreen.hidden = name !== 'success';
  }

  function scrollToElement(element) {
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function startRegistration(isNew) {
    if (isNew === true) {
      resetForm();
    }
    showScreen('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    window.setTimeout(function () {
      scrollToElement(els.registrationForm);
      if (els.centerSelect) {
        try {
          els.centerSelect.focus({ preventScroll: true });
        } catch (error) {
          els.centerSelect.focus();
        }
      }
    }, 80);
  }

  function goHome() {
    var leavingForm = !els.registrationForm.hidden;

    if (leavingForm && isFormDirty()) {
      var confirmed = window.confirm('سيتم فقدان البيانات غير المحفوظة. هل تريد الخروج؟');
      if (!confirmed) return;
      resetForm();
    }

    showScreen('welcome');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* --------------------------------------------------------------------- */
  /* Form                                                                   */
  /* --------------------------------------------------------------------- */

  function markFormDirty() {
    formDirty = true;
  }

  function isFormDirty() {
    if (!formDirty) return false;
    return Boolean(
      (els.centerSelect.value || '').trim() ||
        els.fullName.value.trim() ||
        els.phone.value.trim() ||
        els.village.value.trim() ||
        els.notes.value.trim() ||
        els.consent.checked ||
        (els.personalPhoto.files && els.personalPhoto.files.length) ||
        (els.idCardPhoto.files && els.idCardPhoto.files.length)
    );
  }

  function resetForm() {
    els.form.reset();
    formDirty = false;
    els.submitBtn.disabled = false;
    els.submitBtnText.textContent = DEFAULT_SUBMIT_TEXT;
    els.formStatus.textContent = '';
    els.phone.setCustomValidity('');
    els.fullName.setCustomValidity('');
    clearPhoto('personalPhoto');
    clearPhoto('idCardPhoto');
    updateNotesCount();
  }

  function updateNotesCount() {
    if (els.notesCount) {
      els.notesCount.textContent = String(els.notes.value.length);
    }
  }

  function handlePhoneInput() {
    var converted = convertArabicDigits(els.phone.value).replace(/[^\d]/g, '');
    if (converted !== els.phone.value) {
      els.phone.value = converted;
    }
    els.phone.setCustomValidity('');
  }

  function handlePhoneBlur() {
    var value = normalizePhone(els.phone.value);
    if (value !== els.phone.value) {
      els.phone.value = value;
    }
    if (!value) {
      els.phone.setCustomValidity('');
      return;
    }
    els.phone.setCustomValidity(isValidPhone(value) ? '' : 'أدخل رقم هاتف مصري صحيح مكوّن من 11 رقمًا يبدأ بـ 010 أو 011 أو 012 أو 015.');
  }

  function handleFileChange(key) {
    var input = key === 'personalPhoto' ? els.personalPhoto : els.idCardPhoto;
    var file = input.files && input.files[0];
    var preview = key === 'personalPhoto' ? els.personalPhotoPreview : els.idCardPhotoPreview;
    var wrap = key === 'personalPhoto' ? els.personalPhotoPreviewWrap : els.idCardPhotoPreviewWrap;

    clearPhoto(key, true);

    if (!file) return;

    if (!file.type || file.type.indexOf('image/') !== 0) {
      input.value = '';
      toast('الملف المختار ليس صورة. اختر صورة بصيغة JPG أو PNG أو WebP.', 'error');
      return;
    }

    if (file.size > CONFIG.maxFileSize) {
      input.value = '';
      toast('حجم الصورة كبير. الحد الأقصى 8 ميجابايت.', 'error');
      return;
    }

    if (fileUrls[key]) {
      URL.revokeObjectURL(fileUrls[key]);
    }

    fileUrls[key] = URL.createObjectURL(file);
    preview.src = fileUrls[key];
    wrap.hidden = false;
    formDirty = true;
  }

  function clearPhoto(key, keepInput) {
    if (!key) return;

    var input = key === 'personalPhoto' ? els.personalPhoto : els.idCardPhoto;
    var preview = key === 'personalPhoto' ? els.personalPhotoPreview : els.idCardPhotoPreview;
    var wrap = key === 'personalPhoto' ? els.personalPhotoPreviewWrap : els.idCardPhotoPreviewWrap;

    if (!input || !preview || !wrap) return;

    if (fileUrls[key]) {
      URL.revokeObjectURL(fileUrls[key]);
      fileUrls[key] = null;
    }

    preview.removeAttribute('src');
    wrap.hidden = true;

    if (keepInput !== true) {
      input.value = '';
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    var phone = normalizePhone(els.phone.value);
    els.phone.value = phone;

    if (!isValidPhone(phone)) {
      els.phone.setCustomValidity('أدخل رقم هاتف مصري صحيح مكوّن من 11 رقمًا يبدأ بـ 010 أو 011 أو 012 أو 015.');
      els.phone.reportValidity();
      return;
    }

    var name = normalizeName(els.fullName.value);
    els.fullName.value = name;

    if (name.length < 3) {
      els.fullName.setCustomValidity('أدخل الاسم بالكامل (3 أحرف على الأقل).');
      els.fullName.reportValidity();
      return;
    }

    if (!els.form.checkValidity()) {
      els.form.reportValidity();
      return;
    }

    var existing = getRequests();
    if (existing.some(function (request) { return request.phone === phone; })) {
      var proceed = window.confirm('يوجد طلب محفوظ مسبقًا بنفس رقم الهاتف على هذا الجهاز. هل تريد حفظ طلب جديد؟');
      if (!proceed) return;
    }

    if (existing.length >= CONFIG.maxRecords) {
      toast('وصلت للحد الأقصى من الطلبات المحفوظة على هذا المتصفح.', 'error');
      return;
    }

    var request = {
      id: nextRequestId(existing),
      name: name,
      phone: phone,
      center: els.centerSelect.value,
      village: els.village.value.trim(),
      notes: els.notes.value.trim(),
      status: STATUSES[0],
      createdAt: new Date().toISOString(),
    };

    els.submitBtn.disabled = true;
    els.submitBtnText.textContent = 'جارٍ الحفظ...';
    els.formStatus.textContent = 'جارٍ حفظ الطلب على هذا الجهاز.';

    var saved = saveRequests(existing.concat([request]));

    els.submitBtn.disabled = false;
    els.submitBtnText.textContent = DEFAULT_SUBMIT_TEXT;

    if (!saved) {
      els.formStatus.textContent = 'تعذر حفظ الطلب. تحقق من إعدادات المتصفح وحاول مرة أخرى.';
      return;
    }

    resetForm();
    currentRequestId = request.id;
    showSuccess(request);
  }

  function showSuccess(request) {
    els.successRequestId.textContent = request.id;
    els.successCard.innerHTML = cardHTML(request);
    showScreen('success');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    els.formStatus.textContent = '';

    if (storageOK) {
      toast('تم حفظ الطلب بنجاح على هذا الجهاز.', 'success');
    } else {
      toast('تم الحفظ مؤقتًا لهذه الجلسة فقط. المتصفح يمنع الحفظ الدائم.', 'error');
    }

    window.setTimeout(function () {
      if (els.successTitle) {
        els.successTitle.setAttribute('tabindex', '-1');
        try {
          els.successTitle.focus({ preventScroll: true });
        } catch (error) {
          els.successTitle.focus();
        }
      }
    }, 120);
  }

  function deleteCurrentRequest() {
    if (!currentRequestId) return;

    var confirmed = window.confirm('سيتم حذف هذا الطلب من هذا الجهاز نهائيًا. هل تريد المتابعة؟');
    if (!confirmed) return;

    var remaining = getRequests().filter(function (request) {
      return request.id !== currentRequestId;
    });

    if (!saveRequests(remaining)) return;

    currentRequestId = null;
    showScreen('welcome');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('تم حذف الطلب من هذا الجهاز.', 'success');
  }

  /* --------------------------------------------------------------------- */
  /* Printing                                                               */
  /* --------------------------------------------------------------------- */

  function printCurrentRequest() {
    var request = getRequests().find(function (item) {
      return item.id === currentRequestId;
    });

    if (!request) {
      toast('لم يتم العثور على الطلب. ربما تم حذفه.', 'error');
      return;
    }

    printRequest(request);
  }

  function printRequest(request) {
    els.printArea.innerHTML = cardHTML(request);
    window.print();
  }

  /* --------------------------------------------------------------------- */
  /* Admin                                                                  */
  /* --------------------------------------------------------------------- */

  function openAdmin() {
    lastFocusedElement = document.activeElement;
    els.adminModal.hidden = false;
    document.body.classList.add('modal-open');

    if (isAdminAuthed()) {
      showAdminPanel();
    } else {
      showAdminLogin();
    }

    window.setTimeout(function () {
      if (els.adminPanel.hidden) {
        els.adminPassword.focus();
      } else {
        els.adminSearch.focus();
      }
    }, 60);
  }

  function closeAdmin() {
    if (els.adminModal.hidden) return;

    els.adminModal.hidden = true;
    document.body.classList.remove('modal-open');

    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }

  function showAdminLogin() {
    els.adminLoginView.hidden = false;
    els.adminPanel.hidden = true;
    els.adminLoginError.hidden = true;
    els.adminPassword.removeAttribute('aria-invalid');
    els.adminPassword.value = '';
  }

  function showAdminPanel() {
    els.adminLoginView.hidden = true;
    els.adminPanel.hidden = false;
    els.adminSearch.value = '';
    renderAdminList();
  }

  function handleAdminLogin(event) {
    event.preventDefault();

    if (els.adminPassword.value === CONFIG.adminPassword) {
      try {
        sessionStorage.setItem(CONFIG.adminKey, '1');
      } catch (error) {
        /* sessionStorage can be blocked; the panel still works for this view. */
      }
      els.adminLoginError.hidden = true;
      els.adminPassword.removeAttribute('aria-invalid');
      showAdminPanel();
      toast('مرحبًا بك في لوحة الإدارة.', 'success');
      return;
    }

    els.adminLoginError.hidden = false;
    els.adminPassword.setAttribute('aria-invalid', 'true');
    els.adminPassword.select();
    els.adminPassword.focus();
  }

  function logoutAdmin() {
    try {
      sessionStorage.removeItem(CONFIG.adminKey);
    } catch (error) {
      /* ignore */
    }
    showAdminLogin();
    els.adminPassword.focus();
    toast('تم تسجيل الخروج من لوحة الإدارة.');
  }

  function isAdminAuthed() {
    try {
      return sessionStorage.getItem(CONFIG.adminKey) === '1';
    } catch (error) {
      return false;
    }
  }

  function handleAdminListClick(event) {
    var button = event.target.closest('[data-admin-action]');
    if (!button) return;

    var action = button.getAttribute('data-admin-action');
    var id = button.getAttribute('data-id');
    if (!id) return;

    var request = getRequests().find(function (item) {
      return item.id === id;
    });
    if (!request) {
      toast('لم يتم العثور على الطلب.', 'error');
      renderAdminList();
      return;
    }

    if (action === 'print') {
      printRequest(request);
      return;
    }

    if (action === 'delete') {
      var confirmed = window.confirm('حذف الطلب رقم ' + request.id + ' نهائيًا من هذا الجهاز؟');
      if (!confirmed) return;

      var remaining = getRequests().filter(function (item) {
        return item.id !== id;
      });

      if (!saveRequests(remaining)) return;
      if (currentRequestId === id) currentRequestId = null;
      renderAdminList();
      toast('تم حذف الطلب.', 'success');
    }
  }

  function handleAdminListChange(event) {
    var select = event.target.closest('select[data-status-id]');
    if (!select) return;

    var id = select.getAttribute('data-status-id');
    var status = select.value;

    if (STATUSES.indexOf(status) === -1) return;

    var requests = getRequests();
    var target = requests.find(function (item) {
      return item.id === id;
    });
    if (!target) return;

    target.status = status;
    if (!saveRequests(requests)) return;

    renderAdminList();
    toast('تم تحديث حالة الطلب إلى: ' + status, 'success');
  }

  function renderAdminList() {
    var all = getSortedRequests();
    var query = normalizeArabic(els.adminSearch.value);
    var filtered = query
      ? all.filter(function (request) {
          var haystack = normalizeArabic(
            [request.id, request.name, request.phone, request.center, request.village].join(' ')
          );
          return haystack.indexOf(query) !== -1;
        })
      : all;

    els.statTotal.textContent = String(all.length);
    els.statToday.textContent = String(
      all.filter(function (request) {
        return isToday(request.createdAt);
      }).length
    );
    els.statCenters.textContent = String(
      new Set(
        all
          .map(function (request) {
            return request.center;
          })
          .filter(Boolean)
      ).size
    );

    els.adminStorageWarning.hidden = storageOK;

    if (!filtered.length) {
      if (!all.length) {
        els.adminList.innerHTML =
          '<div class="empty-state">لا توجد طلبات محفوظة على هذا المتصفح بعد.<br>ستظهر هنا أي طلبات تُحفظ من الاستمارة.</div>';
      } else {
        els.adminList.innerHTML =
          '<div class="empty-state">لا توجد نتائج مطابقة لبحثك.<br>جرّب اسمًا أو رقم هاتف أو مركزًا آخر.</div>';
      }
      return;
    }

    els.adminList.innerHTML = filtered.map(requestCardHTML).join('');
  }

  function requestCardHTML(request) {
    var phone = String(request.phone || '');
    var phoneHref = phone.replace(/[^\d+]/g, '');

    return (
      '<article class="admin-request">' +
        '<div class="admin-request__top">' +
          '<div class="min-w-0">' +
            '<div class="admin-request__name">' + escapeHTML(request.name) + '</div>' +
            '<div class="admin-request__id">' + escapeHTML(request.id) + '</div>' +
          '</div>' +
          badgeHTML(request.status) +
        '</div>' +
        '<div class="admin-request__meta">' +
          '<div><span>الهاتف</span><strong dir="ltr">' + escapeHTML(phone) + '</strong></div>' +
          '<div><span>المركز</span><strong>' + escapeHTML(request.center) + '</strong></div>' +
          '<div><span>القرية / المنطقة</span><strong>' + escapeHTML(request.village || '—') + '</strong></div>' +
          '<div><span>تاريخ التقديم</span><strong>' + escapeHTML(formatDate(request.createdAt, true)) + '</strong></div>' +
        '</div>' +
        (request.notes
          ? '<div class="admin-request__notes">' + escapeHTML(request.notes) + '</div>'
          : '') +
        '<div class="admin-request__actions">' +
          '<select class="status-select" data-status-id="' + escapeHTML(request.id) + '" aria-label="تغيير حالة الطلب">' +
            STATUSES.map(function (status) {
              return (
                '<option value="' + escapeHTML(status) + '"' + (status === request.status ? ' selected' : '') + '>' +
                  escapeHTML(status) +
                '</option>'
              );
            }).join('') +
          '</select>' +
          '<button type="button" class="icon-btn" data-admin-action="print" data-id="' + escapeHTML(request.id) + '">' +
            '<svg class="icon" aria-hidden="true"><use href="#i-print"></use></svg> طباعة' +
          '</button>' +
          '<a class="icon-btn" href="tel:' + escapeHTML(phoneHref) + '">' +
            '<svg class="icon" aria-hidden="true"><use href="#i-phone"></use></svg> اتصال' +
          '</a>' +
          '<button type="button" class="icon-btn icon-btn--danger" data-admin-action="delete" data-id="' + escapeHTML(request.id) + '">' +
            '<svg class="icon" aria-hidden="true"><use href="#i-trash"></use></svg> حذف' +
          '</button>' +
        '</div>' +
      '</article>'
    );
  }

  function clearAllRequests() {
    var all = getRequests();

    if (!all.length) {
      toast('لا توجد بيانات لمسحها.');
      return;
    }

    var firstConfirm = window.confirm('سيتم مسح جميع الطلبات المحفوظة على هذا المتصفح نهائيًا. هل تريد المتابعة؟');
    if (!firstConfirm) return;

    var secondConfirm = window.confirm('تأكيد أخير: لا يمكن التراجع عن هذه الخطوة. مسح كل البيانات؟');
    if (!secondConfirm) return;

    if (!saveRequests([])) return;

    currentRequestId = null;
    renderAdminList();
    toast('تم مسح جميع الطلبات من هذا الجهاز.', 'success');
  }

  function exportCSV() {
    var requests = getSortedRequests();

    if (!requests.length) {
      toast('لا توجد طلبات لتصديرها.', 'error');
      return;
    }

    var headers = ['رقم الطلب', 'الاسم', 'الهاتف', 'المركز', 'القرية / المنطقة', 'الحالة', 'تاريخ التقديم', 'ملاحظات'];

    var rows = requests.map(function (request) {
      return [
        csvCell(request.id),
        csvCell(request.name),
        phoneCSVCell(request.phone),
        csvCell(request.center),
        csvCell(request.village || ''),
        csvCell(request.status),
        csvCell(formatDate(request.createdAt, true)),
        csvCell(request.notes || ''),
      ];
    });

    var csv = '\uFEFF' + [headers.map(csvCell).join(',')].concat(rows.map(function (row) { return row.join(','); })).join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = 'طلبات-الانضمام-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);

    toast('تم تجهيز ملف CSV (' + requests.length + ' طلب).', 'success');
  }

  /* --------------------------------------------------------------------- */
  /* Storage                                                                */
  /* --------------------------------------------------------------------- */

  function checkStorageAvailability() {
    try {
      var testKey = '__mfw_storage_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      storageOK = true;
    } catch (error) {
      storageOK = false;
      memoryRequests = [];
    }
  }

  function getRequests() {
    if (!storageOK) return memoryRequests.slice();

    try {
      var raw = localStorage.getItem(CONFIG.storageKey);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidRecord);
    } catch (error) {
      return [];
    }
  }

  function saveRequests(requests) {
    if (!storageOK) {
      memoryRequests = requests.slice();
      return true;
    }

    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(requests));
      return true;
    } catch (error) {
      toast('تعذر حفظ البيانات. قد تكون مساحة التخزين ممتلئة أو المتصفح يمنع الحفظ.', 'error');
      return false;
    }
  }

  function isValidRecord(record) {
    return Boolean(
      record &&
        typeof record === 'object' &&
        typeof record.id === 'string' &&
        typeof record.name === 'string' &&
        typeof record.phone === 'string'
    );
  }

  function getSortedRequests() {
    return getRequests().slice().sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  function nextRequestId(existing) {
    var year = new Date().getFullYear();
    var prefix = 'MFW-' + year + '-';
    var max = 0;

    existing.forEach(function (request) {
      if (request.id && request.id.indexOf(prefix) === 0) {
        var value = parseInt(request.id.slice(prefix.length), 10);
        if (!Number.isNaN(value) && value > max) max = value;
      }
    });

    return prefix + String(max + 1).padStart(4, '0');
  }

  /* --------------------------------------------------------------------- */
  /* Card + helpers                                                         */
  /* --------------------------------------------------------------------- */

  function cardHTML(request) {
    return (
      '<div class="id-card">' +
        '<div class="id-card__head">' +
          '<img class="id-card__logo" src="assets/img/logo.svg" alt="" width="46" height="46">' +
          '<div class="id-card__brand">' +
            '<strong>حزب مستقبل وطن</strong>' +
            '<span>أمانة محافظة المنوفية</span>' +
          '</div>' +
        '</div>' +
        '<div class="id-card__body">' +
          '<div class="id-card__kicker">طلب انضمام — نسخة تجريبية</div>' +
          '<h3 class="id-card__name">' + escapeHTML(request.name) + '</h3>' +
          '<div class="id-card__grid">' +
            '<div class="id-card__item"><span>رقم الطلب</span><strong dir="ltr">' + escapeHTML(request.id) + '</strong></div>' +
            '<div class="id-card__item"><span>المركز التنظيمي</span><strong>' + escapeHTML(request.center) + '</strong></div>' +
            '<div class="id-card__item"><span>الهاتف</span><strong dir="ltr">' + escapeHTML(request.phone) + '</strong></div>' +
            '<div class="id-card__item"><span>القرية / المنطقة</span><strong>' + escapeHTML(request.village || '—') + '</strong></div>' +
          '</div>' +
          '<div class="mt-3 flex items-center justify-between gap-2">' +
            '<span class="text-[10px] text-slate-400">حالة الطلب</span>' +
            badgeHTML(request.status) +
          '</div>' +
        '</div>' +
        '<div class="id-card__foot">' +
          '<span>تاريخ التقديم: <strong>' + escapeHTML(formatDate(request.createdAt)) + '</strong></span>' +
          '<span>توقيع مقدم الطلب: ________</span>' +
        '</div>' +
      '</div>' +
      '<p class="id-card__note">مستند تجريبي غير رسمي — لم يُسجَّل الطلب لدى الحزب أو أي جهة حكومية. البيانات محفوظة على جهاز مقدم الطلب فقط.</p>'
    );
  }

  function badgeHTML(status) {
    var safeStatus = STATUSES.indexOf(status) !== -1 ? status : STATUSES[0];
    return '<span class="badge ' + badgeClass(safeStatus) + '">' + escapeHTML(safeStatus) + '</span>';
  }

  function badgeClass(status) {
    switch (status) {
      case 'تم التواصل':
        return 'badge--contacted';
      case 'مقبول':
        return 'badge--accepted';
      case 'مرفوض':
        return 'badge--rejected';
      default:
        return 'badge--pending';
    }
  }

  function formatDate(value, withTime) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    try {
      return new Intl.DateTimeFormat('ar-EG', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'long' }).format(date);
    } catch (error) {
      return date.toLocaleDateString('ar-EG');
    }
  }

  function isToday(value) {
    var date = new Date(value);
    var now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }

  function normalizeName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
  }

  function convertArabicDigits(value) {
    return String(value || '').replace(/[٠-٩]/g, function (digit) {
      return String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit));
    });
  }

  function normalizePhone(value) {
    var digits = convertArabicDigits(value).replace(/\D/g, '');

    if (/^20(1[0125]\d{8})$/.test(digits)) {
      digits = '0' + digits.slice(2);
    }

    return digits.slice(0, 11);
  }

  function isValidPhone(value) {
    return /^01[0125]\d{8}$/.test(String(value || ''));
  }

  function normalizeArabic(value) {
    return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[\u064B-\u0652\u0640]/g, '');
  }

  function csvCell(value) {
    var text = String(value == null ? '' : value);

    /* Guard against spreadsheet formula injection. */
    if (/^[=+\-@\t\r]/.test(text)) {
      text = "'" + text;
    }

    return '"' + text.replace(/"/g, '""') + '"';
  }

  function phoneCSVCell(value) {
    var safe = String(value || '').replace(/[^0-9]/g, '');
    return '"=""' + safe + '"""';
  }

  function escapeHTML(value) {
    var map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return map[character];
    });
  }

  function setFooterYear() {
    if (els.footerYear) {
      els.footerYear.textContent = String(new Date().getFullYear());
    }
  }

  function toast(message, tone) {
    if (!els.toastBox || !els.toastText) return;

    els.toastText.textContent = message;
    els.toastBox.setAttribute('data-tone', tone || 'info');
    els.toastBox.hidden = false;

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      els.toastBox.hidden = true;
    }, 4200);
  }

  /* --------------------------------------------------------------------- */
  /* Keyboard accessibility                                                 */
  /* --------------------------------------------------------------------- */

  function handleGlobalKeydown(event) {
    if (els.adminModal.hidden) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeAdmin();
      return;
    }

    if (event.key !== 'Tab') return;

    var focusables = els.adminModal.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    var visibleFocusables = Array.prototype.filter.call(focusables, function (element) {
      return element.offsetParent !== null;
    });

    if (!visibleFocusables.length) return;

    var first = visibleFocusables[0];
    var last = visibleFocusables[visibleFocusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
})();
