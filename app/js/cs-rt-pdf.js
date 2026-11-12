/* The Risk Tolerance questionnaire's own PDF: the firm's own fillable form (assets/rt-form.js, the same form the Risk Tolerance website fills) completed with the client's answers, the score and the profile.
   The client's signature, the place and the date of signing are left blank: the PDF is sent to the client later to be signed. It is a separate file from the application's PDF (cs-pdf.js). */
(function () {
  var CS = window.CS, schema = CS.schema, store = CS.store, RT = schema.rt;

  /* the form's standard fonts cover Latin-1 only: keep names readable rather than failing */
  function safe(text) {
    return String(text == null ? '' : text).normalize('NFC').replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x20-\x7E\xA0-\xFF]/g, '').trim();
  }
  function template() {
    var bin = atob(window.CS_RT_FORM), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  /* Returns a promise of { bytes, blob, fileName, reference, score, category }. It refuses, with the reason, until the 18 statements and the 5 questions are answered and the client's name is on the form. */
  function build(state) {
    var r = store.rtStatus(state), name = safe(store.clientName(state));
    if (!r.complete) return Promise.reject(new Error('Answer all 18 statements and the 5 capacity questions first (' + (r.statements + r.capacity) + ' of 23 so far).'));
    if (!name) return Promise.reject(new Error('Enter the client’s name on the first page first: it is printed on the questionnaire.'));
    store.rtSync(state, false);
    var lib = window.PDFLib, reference = state.f.risk_ref.v, planner = safe(schema.planner), date = state.f.date.v || RT.formatDate(new Date());
    return lib.PDFDocument.load(template()).then(function (pdf) {
      var form = pdf.getForm();
      return pdf.embedFont(lib.StandardFonts.Helvetica).then(function (font) {
        form.getTextField('client_name').setText(name);
        form.getTextField('planner_name').setText(planner);
        form.getTextField('assessment_date').setText(date);
        r.choices.statements.forEach(function (c, i) { form.getRadioGroup('q' + (i + 1)).select(String(RT.scoreFor(i + 1, c))); });
        form.getTextField('total_score').setText(String(r.score));
        form.getTextField('risk_category').setText(r.category.name);
        r.choices.capacity.forEach(function (c, i) { form.getRadioGroup(RT.CAPACITY[i].field).select(String(c + 1)); });
        var profile = form.getRadioGroup('selected_profile'), opt = profile.getOptions().filter(function (o) { return o.toLowerCase() === r.category.name.toLowerCase(); })[0];
        if (opt) profile.select(opt);
        form.getTextField('signature_client_name').setText(name);
        form.getTextField('signature_planner_name').setText(planner);
        /* client_signature, signed_at and signed_date stay empty: the client signs and dates it later */
        form.updateFieldAppearances(font);
        form.flatten();
        var footer = 'Risk tolerance questionnaire completed with the client on ' + date + '  |  Ref ' + reference + '  |  To be signed and dated by the client';
        pdf.getPages().forEach(function (page) {
          var w = page.getSize().width, size = 6.5;
          page.drawText(footer, { x: (w - font.widthOfTextAtSize(footer, size)) / 2, y: 14, size: size, font: font, color: lib.rgb(0.35, 0.38, 0.42) });
        });
        pdf.setTitle('Risk Tolerance Assessment - ' + name); pdf.setAuthor(planner); pdf.setSubject('Ref ' + reference); pdf.setCreator('Wealth Revolution Investment Capture Sheet');
        return pdf.save();
      });
    }).then(function (bytes) {
      return { bytes: bytes, blob: new Blob([bytes], { type: 'application/pdf' }), fileName: store.rtFileName(state), reference: reference, score: r.score, category: r.category };
    });
  }
  CS.rtpdf = { build: build };
})();
