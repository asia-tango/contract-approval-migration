<%-- ВИГАДАНИЙ код, створений спеціально для тестового завдання --%>
<%@ page contentType="text/html;charset=UTF-8" %>
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<%
  // Ролі приходять із SSO-фільтра
  boolean canEdit = request.isUserInRole("CONTRACT_EDITOR");
  int pageSize = Integer.parseInt(application.getInitParameter("contracts.pageSize")); // у проді = 20
%>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Погодження договорів</title>
  <link rel="stylesheet" href="${ctx}/static/bootstrap-3.3.7/css/bootstrap.min.css"/>
  <script src="${ctx}/static/jquery-1.12.4.min.js"></script>
  <script>
    var CAN_EDIT = <%= canEdit %>;
    var PAGE_SIZE = <%= pageSize %>;
    var COMMITTEE_LIMIT_UAH = 1000000; // TODO винести в конфіг (з 2019 р.)
  </script>
  <script>
/* Логіка екрана погодження договорів (2017–2021, різні автори) */

var state = { page: 1, total: 0, rates: null, pollTimer: null };

$(function () {
  loadList();

  $('#f-status').on('change', function () { loadList(); });
  $('#f-q').on('keyup', function () { loadList(); });

  $('#prev').on('click', function () {
    if (state.page > 1) { state.page--; loadList(); }
  });
  $('#next').on('click', function () {
    if (state.page * PAGE_SIZE < state.total) { state.page++; loadList(); }
  });

  $('#list').on('click', 'tbody tr', function () { openContract($(this).data('id')); });

  $('#c-amount, #c-currency, #c-vat').on('change keyup', recalc);
  $('#c-sign').on('change', function () { loadRates(); });
  $('#send').on('click', send);
});

/* ---------- Реєстр ---------- */

function loadList() {
  $.getJSON('/api/contracts', {
    status: $('#f-status').val(),
    q: $('#f-q').val(),
    page: state.page,
    size: PAGE_SIZE
  }, function (resp) {
    state.total = resp.total;
    var $tb = $('#list tbody').empty();
    $.each(resp.items, function (i, c) {
      $tb.append(
        '<tr data-id="' + c.id + '">' +
          '<td>' + c.number + '</td>' +
          '<td>' + c.counterparty + '</td>' +
          '<td class="text-right">' + fmt(c.amount) + ' ' + c.currency + '</td>' +
          '<td>' + statusLabel(c.status) + '</td>' +
        '</tr>'
      );
    });
    $('#page-info').text(state.page + ' / ' + Math.max(1, Math.ceil(state.total / PAGE_SIZE)));
  });
}

/* ---------- Картка ---------- */

function openContract(id) {
  $.getJSON('/api/contracts/' + id, function (c) {
    $('#empty-card').hide();
    $('#card').show();

    $('#c-id').val(c.id);
    $('#c-version').val(c.version);
    $('#c-number').text(c.number);
    $('#c-status').text(statusLabel(c.status));
    $('#c-counterparty').val(c.counterparty);
    $('#c-amount').val(c.amount);
    $('#c-currency').val(c.currency);
    $('#c-vat').prop('checked', c.vatPayer);
    $('#c-sign').val(toUi(c.signDate));
    $('#c-start').val(toUi(c.startDate));
    $('#c-end').val(toUi(c.endDate));
    $('#c-comment').val(c.comment || '');
    $('#c-errors').empty();
    $('#c-approval').hide();

    var editable = CAN_EDIT && (c.status === 'DRAFT' || c.status === 'REJECTED');
    $('#card :input').not('#send').prop('disabled', !editable);
    $('#send').prop('disabled', false).toggle(editable);

    if (c.status === 'ON_APPROVAL' && c.lastApprovalRequestId) {
      startPolling(c.lastApprovalRequestId);
    }
    loadRates();
  });
}

function loadRates() {
  // Курс НБУ саме на дату підписання — вимога фінмоніторингу, НЕ міняти на поточний!
  var d = toApi($('#c-sign').val());
  $.getJSON('/api/rates', { date: d }, function (r) {
    state.rates = r.rates;
    recalc();
  });
}

function recalc() {
  var raw = ($('#c-amount').val() || '').replace(',', '.');
  var amount = parseFloat(raw);
  if (isNaN(amount)) {
    $('#c-vat-amount, #c-uah').text('—');
    $('#c-committee').hide();
    return;
  }

  var vat = $('#c-vat').is(':checked') ? Math.round(amount / 6 * 100) / 100 : 0;
  $('#c-vat-amount').text(vat ? fmt(vat) : 'без ПДВ');

  var cur = $('#c-currency').val();
  var rate = cur === 'UAH' ? 1 : (state.rates ? state.rates[cur] : null);
  if (!rate) {
    $('#c-uah').text('—');
    $('#c-committee').hide();
    return;
  }

  var uah = Math.round(amount * rate * 100) / 100;
  $('#c-uah').text(fmt(uah));
  $('#c-committee').toggle(uah > COMMITTEE_LIMIT_UAH);
}

function validate() {
  var errors = [];
  var rawAmount = $.trim($('#c-amount').val());
  var amount = parseFloat(rawAmount.replace(',', '.'));

  if (!$.trim($('#c-counterparty').val())) errors.push('Вкажіть контрагента');
  if (isNaN(amount) || amount <= 0) errors.push('Сума має бути більшою за 0');
  if (!/^\d+([.,]\d{1,2})?$/.test(rawAmount)) errors.push('Не більше 2 знаків після коми');

  var start = $('#c-start').val();
  var end = $('#c-end').val();
  if (start && end && end < start) errors.push('Дата закінчення раніше дати початку');

  if ($('#c-committee').is(':visible') && $.trim($('#c-comment').val()).length < 20) {
    errors.push('Для комітету потрібне обґрунтування (від 20 символів)');
  }
  return errors;
}

/* ---------- Надсилання ---------- */

function send() {
  var errors = validate();
  if (errors.length) {
    $('#c-errors').html(errors.join('<br>'));
    return;
  }
  $('#c-errors').empty();

  var $btn = $('#send').prop('disabled', true);
  var id = $('#c-id').val();

  $.ajax({
    url: '/api/contracts/' + id + '/approval-requests',
    type: 'POST',
    contentType: 'application/json',
    timeout: 5000,
    data: JSON.stringify({
      version: +$('#c-version').val(),
      route: $('#c-committee').is(':visible') ? 'COMMITTEE' : 'STANDARD',
      data: {
        counterparty: $('#c-counterparty').val(),
        amount: parseFloat($('#c-amount').val().replace(',', '.')),
        currency: $('#c-currency').val(),
        vatPayer: $('#c-vat').is(':checked'),
        signDate: toApi($('#c-sign').val()),
        startDate: toApi($('#c-start').val()),
        endDate: toApi($('#c-end').val()),
        comment: $('#c-comment').val()
      }
    })
  }).done(function (r) {
    $('#c-status').text(statusLabel('ON_APPROVAL'));
    $('#send').hide();
    $('#card :input').prop('disabled', true);
    startPolling(r.approvalRequestId);
    loadList();
  }).fail(function (xhr) {
    $btn.prop('disabled', false);
    if (xhr.status === 409) {
      alert('Договір змінив інший користувач. Оновіть сторінку.');
    } else if (xhr.status === 422) {
      $('#c-errors').html($.map(xhr.responseJSON.errors, function (e) { return e.message; }).join('<br>'));
    } else {
      alert('Помилка, спробуйте ще раз');
    }
  });
}

function startPolling(reqId) {
  $('#c-approval').show();
  $('#c-approval-status').text(statusLabel('PENDING'));
  state.pollTimer = setInterval(function () {
    $.getJSON('/api/approval-requests/' + reqId, function (r) {
      $('#c-approval-status').text(statusLabel(r.status) + (r.reason ? ' — ' + r.reason : ''));
      if (r.status !== 'PENDING') {
        clearInterval(state.pollTimer);
        loadList();
      }
    });
  }, 5000);
}

/* ---------- Утиліти ---------- */

function toUi(iso) {        // 2026-12-15 -> 15.12.2026
  if (!iso) return '';
  var p = iso.split('-');
  return p[2] + '.' + p[1] + '.' + p[0];
}

function toApi(ui) {        // 15.12.2026 -> 2026-12-15
  if (!ui) return '';
  var p = ui.split('.');
  return p[2] + '-' + p[1] + '-' + p[0];
}

function fmt(n) {           // 1234567.8 -> "1 234 567,80"
  return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ').replace('.', ',');
}

function statusLabel(s) {
  return {
    DRAFT: 'Чернетка',
    ON_APPROVAL: 'На погодженні',
    APPROVED: 'Погоджено',
    REJECTED: 'Відхилено',
    PENDING: 'Очікує рішення'
  }[s] || s;
}
  </script>
</head>
<body>
<div class="container-fluid">
  <div class="row">

    <!-- ===== Реєстр ===== -->
    <div class="col-md-5">
      <form id="filter" class="form-inline" onsubmit="return false">
        <select id="f-status" class="form-control">
          <option value="">Усі статуси</option>
          <option value="DRAFT" selected>Чернетка</option>
          <option value="ON_APPROVAL">На погодженні</option>
          <option value="APPROVED">Погоджено</option>
          <option value="REJECTED">Відхилено</option>
        </select>
        <input id="f-q" class="form-control" placeholder="Номер або контрагент"/>
      </form>

      <table id="list" class="table table-hover">
        <thead><tr><th>№</th><th>Контрагент</th><th>Сума</th><th>Статус</th></tr></thead>
        <tbody></tbody>
      </table>

      <div id="pager">
        <button type="button" id="prev" class="btn btn-default">&laquo;</button>
        <span id="page-info"></span>
        <button type="button" id="next" class="btn btn-default">&raquo;</button>
      </div>
    </div>

    <!-- ===== Картка договору ===== -->
    <div class="col-md-7">
      <div id="empty-card" class="text-muted">Оберіть договір зі списку</div>

      <form id="card" style="display:none" onsubmit="return false">
        <h3>Договір № <span id="c-number"></span> <span id="c-status" class="label label-info"></span></h3>
        <input type="hidden" id="c-id"/>
        <input type="hidden" id="c-version"/>

        <label>Контрагент</label>
        <input id="c-counterparty" class="form-control"/>

        <label>Сума (з ПДВ)</label>
        <input id="c-amount" class="form-control"/>
        <select id="c-currency" class="form-control">
          <option>UAH</option><option>USD</option><option>EUR</option>
        </select>
        <label><input type="checkbox" id="c-vat"/> Платник ПДВ</label>

        <div>ПДВ: <b id="c-vat-amount">—</b></div>
        <div>Еквівалент, грн: <b id="c-uah">—</b></div>
        <div id="c-committee" class="alert alert-warning" style="display:none">
          Потрібне погодження тендерного комітету
        </div>

        <label>Дата підписання</label>
        <input id="c-sign" class="form-control" placeholder="дд.мм.рррр"/>
        <label>Діє з</label>
        <input id="c-start" class="form-control" placeholder="дд.мм.рррр"/>
        <label>Діє по</label>
        <input id="c-end" class="form-control" placeholder="дд.мм.рррр"/>

        <label>Коментар</label>
        <textarea id="c-comment" class="form-control"></textarea>

        <div id="c-errors" class="text-danger"></div>

        <% if (canEdit) { %>
          <button type="button" id="send" class="btn btn-primary">Надіслати на погодження</button>
        <% } %>

        <div id="c-approval" style="display:none">
          Статус погодження: <b id="c-approval-status"></b>
        </div>
      </form>
    </div>

  </div>
</div>
</body>
</html>
