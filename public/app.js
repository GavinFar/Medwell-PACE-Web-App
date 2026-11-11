/* =========================================================
   Medwell PACE – small shared helpers used by every page
   ========================================================= */

window.PACE = {
  /** Show an error message under a field (or clear it when message is empty). */
  setError: function (input, message) {
    var errorEl = document.getElementById(input.id + '-error');
    if (input.dataset.baseDescribedby === undefined) {
      input.dataset.baseDescribedby = input.getAttribute('aria-describedby') || '';
    }
    var base = input.dataset.baseDescribedby;

    if (message) {
      input.setAttribute('aria-invalid', 'true');
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.hidden = false;
        input.setAttribute('aria-describedby', (base + ' ' + errorEl.id).trim());
      }
    } else {
      input.removeAttribute('aria-invalid');
      if (errorEl) errorEl.hidden = true;
      if (base) input.setAttribute('aria-describedby', base);
      else input.removeAttribute('aria-describedby');
    }
  },

  isEmail: function (value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  },

  getParam: function (name) {
    return new URLSearchParams(window.location.search).get(name);
  },

  /** Counts down on a button, then enables it. Returns a function that stops the timer. */
  countdown: function (button, seconds, waitingText, readyText) {
    var left = seconds;
    button.disabled = true;
    button.textContent = waitingText.replace('{s}', left);
    var timer = setInterval(function () {
      left -= 1;
      if (left <= 0) {
        clearInterval(timer);
        button.disabled = false;
        button.textContent = readyText;
      } else {
        button.textContent = waitingText.replace('{s}', left);
      }
    }, 1000);
    return function () { clearInterval(timer); };
  }
};

/* "Show / Hide" buttons on password fields */
document.querySelectorAll('.toggle-pw').forEach(function (btn) {
  var input = document.getElementById(btn.dataset.target);
  if (!input) return;
  btn.addEventListener('click', function () {
    var show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.textContent = show ? 'Hide' : 'Show';
    btn.setAttribute('aria-pressed', String(show));
    btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
});
