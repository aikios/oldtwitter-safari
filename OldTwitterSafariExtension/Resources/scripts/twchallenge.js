let solverIframe;
let solveId = 0;
let solveCallbacks = {};
let solveQueue = [];
let solverReady = false;
let solverErrored = false;
let sentData = false;

// Inline sandbox.html as base64 and load via srcdoc — no fetch needed at all.
// srcdoc iframes inherit the parent's origin (x.com), so:
//   - eval() works (our DNR rules strip x.com's CSP)
//   - abs.twimg.com fetches work (our DNR CORS rule adds allow-origin for x.com)
//   - postMessage is same-origin, trivially reliable
const SANDBOX_B64 = 'PCFET0NUWVBFIGh0bWw+CjxodG1sIGxhbmc9ImVuIj4KCjxoZWFkPgogICAgPG1ldGEgY2hhcnNldD0iVVRGLTgiPgogICAgPG1ldGEgbmFtZT0idmlld3BvcnQiIGNvbnRlbnQ9IndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xLjAiPgogICAgPHRpdGxlPlNhbmRib3g8L3RpdGxlPgogICAgPG1ldGEgbmFtZT0idHdpdHRlci1zaXRlLXZlcmlmaWNhdGlvbiIgY29udGVudD0ibG9hZGluZyIgLz4KPC9oZWFkPgoKPGJvZHk+CiAgICA8ZGl2IGlkPSJhbmltcyI+PC9kaXY+CiAgICA8c2NyaXB0PgogICAgICAgIGZ1bmN0aW9uIHNsZWVwKG1zKSB7CiAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKTsKICAgICAgICB9CgogICAgICAgIGxldCBpbml0RXJyb3IgPSBmYWxzZSwgc29sdmVyOwogICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgYXN5bmMgZnVuY3Rpb24gKGV2ZW50KSB7CiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbT1QgU2FuZGJveF0gbWVzc2FnZSByZWNlaXZlZCwgb3JpZ2luOicsIGV2ZW50Lm9yaWdpbiwgJ2FjdGlvbjonLCBldmVudC5kYXRhICYmIGV2ZW50LmRhdGEuYWN0aW9uKTsKICAgICAgICAgICAgaWYgKGV2ZW50Lm9yaWdpbiAhPT0gJ2h0dHBzOi8vdHdpdHRlci5jb20nICYmIGV2ZW50Lm9yaWdpbiAhPT0gJ2h0dHBzOi8veC5jb20nICYmICFldmVudC5vcmlnaW4uc3RhcnRzV2l0aCgnc2FmYXJpLXdlYi1leHRlbnNpb246Ly8nKSAmJiAhZXZlbnQub3JpZ2luLnN0YXJ0c1dpdGgoJ2Nocm9tZS1leHRlbnNpb246Ly8nKSAmJiBldmVudC5vcmlnaW4gIT09ICdudWxsJykgewogICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1tPVCBTYW5kYm94XSBpZ25vcmluZyBtZXNzYWdlIGZyb20gdW5leHBlY3RlZCBvcmlnaW46JywgZXZlbnQub3JpZ2luKTsKICAgICAgICAgICAgICAgIHJldHVybjsKICAgICAgICAgICAgfQogICAgICAgICAgICBsZXQgZGF0YSA9IGV2ZW50LmRhdGE7CiAgICAgICAgICAgIGlmIChkYXRhLmFjdGlvbiA9PT0gJ2luaXQnKSB7CiAgICAgICAgICAgICAgICB0cnkgewogICAgICAgICAgICAgICAgICAgIHdpbmRvdy5fX1NDUklQVFNfTE9BREVEX18gPSB7CiAgICAgICAgICAgICAgICAgICAgICAgIHJ1bnRpbWU6IHRydWUKICAgICAgICAgICAgICAgICAgICB9OwogICAgICAgICAgICAgICAgICAgIGNvbnN0IFt2ZW5kb3JEYXRhLCBjaGFsbGVuZ2VEYXRhXSA9IGF3YWl0IFByb21pc2UuYWxsKFsKICAgICAgICAgICAgICAgICAgICAgICAgZmV0Y2goYGh0dHBzOi8vYWJzLnR3aW1nLmNvbS9yZXNwb25zaXZlLXdlYi9jbGllbnQtd2ViL3ZlbmRvci4ke2RhdGEudmVuZG9yQ29kZX0uanNgKS50aGVuKHJlcyA9PiByZXMudGV4dCgpKSwKICAgICAgICAgICAgICAgICAgICAgICAgZmV0Y2goYGh0dHBzOi8vYWJzLnR3aW1nLmNvbS9yZXNwb25zaXZlLXdlYi9jbGllbnQtd2ViL29uZGVtYW5kLnMuJHtkYXRhLmNoYWxsZW5nZUNvZGV9YS5qc2ApLnRoZW4ocmVzID0+IHJlcy50ZXh0KCkpCiAgICAgICAgICAgICAgICAgICAgXSk7CiAgICAgICAgICAgICAgICAgICAgZXZhbCh2ZW5kb3JEYXRhKTsKCiAgICAgICAgICAgICAgICAgICAgbGV0IGFuaW1zRGl2ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FuaW1zJyk7CiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgYW5pbSBvZiBkYXRhLmFuaW1zKSB7CiAgICAgICAgICAgICAgICAgICAgICAgIGFuaW1zRGl2LmlubmVySFRNTCArPSBgXG4ke2FuaW19YDsKICAgICAgICAgICAgICAgICAgICB9CiAgICAgICAgICAgICAgICAgICAgbGV0IHZlcmlmID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignbWV0YVtuYW1lPSJ0d2l0dGVyLXNpdGUtdmVyaWZpY2F0aW9uIl0nKTsKICAgICAgICAgICAgICAgICAgICB2ZXJpZi5jb250ZW50ID0gZGF0YS52ZXJpZmljYXRpb25Db2RlOwogICAgICAgICAgICAgICAgICAgIGxldCBoZWFkZXJSZWdleCA9IC8oXGQrKTooLispPT4uK2RlZmF1bHQ6XChcKT0+KFx3KX1cKTsvOwogICAgICAgICAgICAgICAgICAgIGxldCBoZWFkZXJNYXRjaCA9IGNoYWxsZW5nZURhdGEubWF0Y2goaGVhZGVyUmVnZXgpOwogICAgICAgICAgICAgICAgICAgIGlmICghaGVhZGVyTWF0Y2gpIHsKICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignVWggb2gsIGhlYWRlciBub3QgZm91bmQhISBSZXBvcnQgdG8gaHR0cHM6Ly9naXRodWIuY29tL2RpbWRlbkdEL09sZFR3aXR0ZXIvaXNzdWVzJyk7CiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnNvdXJjZS5wb3N0TWVzc2FnZSh7IGFjdGlvbjogJ2luaXRFcnJvcicsIGVycm9yOiBgSGVhZGVyIG5vdCBmb3VuZCBhdCAke2RhdGEuY2hhbGxlbmdlQ29kZX0gKCR7U3RyaW5nKGNoYWxsZW5nZURhdGEpLnNsaWNlKDAsIDUwMCl9Li4uKWAgfSwgIioiKTsKICAgICAgICAgICAgICAgICAgICAgICAgaW5pdEVycm9yID0gdHJ1ZTsKICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuOwogICAgICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgICAgICAvLyBUTyBFWFRFTlNJT04gUkVWSUVXRVJTIChtb3N0bHkgTW96aWxsYSk6CiAgICAgICAgICAgICAgICAgICAgLy8gVGhpcyBzY3JpcHQgaXMgcGFydCBvZiBUd2l0dGVyJ3Mgc2VjdXJpdHkgY2hhbGxlbmdlLCBiZWZvcmUgbWluZGxlc3NseSByZWplY3RpbmcgZXh0ZW5zaW9uIGFjdHVhbGx5IHJldmlldyB3aGF0IGNvZGUgZG9lcyBwbGVhc2UhIEl0J3MgaW4gc2FuZGJveCBmb3IgYSByZWFzb24uCiAgICAgICAgICAgICAgICAgICAgLy8gSXQgb25seSBldmVyIGV4ZWN1dGVzIGNvZGUgZnJvbSB0cnVzdGVkIFR3aXR0ZXIgZG9tYWluLCBhYnMudHdpbWcuY29tIChzcGVjaWZpY2FsbHkgdGhlaXIgc2NyaXB0IHRoYXQgZ2VuZXJhdGVzIHNlY3VyaXR5IGhlYWRlcnMpCiAgICAgICAgICAgICAgICAgICAgLy8gSXQncyBpbXBvc3NpYmxlIHRvIGhhdmUgaXQgY29udGFpbmVkIGluIGV4dGVuc2lvbiBpdHNlbGYsIHNpbmNlIGl0J3MgZ2VuZXJhdGVkIGR5bmFtaWNhbGx5CiAgICAgICAgICAgICAgICAgICAgLy8geW91IGNhbiBzZWUgd2hlcmUgc2NyaXB0IGlzIGxvYWRlZCBpbiBzY3JpcHRzL3R3Y2hhbGxlbmdlLmpzCiAgICAgICAgICAgICAgICAgICAgLy8gaXQgYWxzbyBjYW4ndCB1c2UgYW55IGV4dGVuc2lvbiBBUElzLCBzaW5jZSBpdCdzIGNvbnRhaW5lZCBpbiBvYmplY3QgdXJsIGlmcmFtZQogICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhdGNoZWRDaGFsbGVuZ2VEYXRhID0gY2hhbGxlbmdlRGF0YQogICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZShoZWFkZXJSZWdleCwgJyQxOiQyPT57d2luZG93Ll9DSEFMTEVOR0U9KCk9PiQzOycpOwogICAgICAgICAgICAgICAgICAgIGV2YWwocGF0Y2hlZENoYWxsZW5nZURhdGEpOwoKICAgICAgICAgICAgICAgICAgICBsZXQgaWQgPSBoZWFkZXJNYXRjaFsxXTsKICAgICAgICAgICAgICAgICAgICAvLyAxKSBDb2xsZWN0IGFsbCBtb2R1bGUgZmFjdG9yaWVzIHRoYXQgaGF2ZSBhbHJlYWR5IGJlZW4gcHVzaGVkCiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2h1bmtzID0gc2VsZi53ZWJwYWNrQ2h1bmtfdHdpdHRlcl9yZXNwb25zaXZlX3dlYiB8fCBbXTsKICAgICAgICAgICAgICAgICAgICBjb25zdCByZWdpc3RyeSA9IHt9OwogICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgcGF5bG9hZCBvZiBjaHVua3MpIHsKICAgICAgICAgICAgICAgICAgICAgICAgLy8gRWFjaCBwYXlsb2FkIGxvb2tzIGxpa2U6IFtjaHVua0lkcywgbW9yZU1vZHVsZXMsIHJ1bnRpbWVdCiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdoZXJlIG1vcmVNb2R1bGVzIGlzIGFuIG9iamVjdDogeyBbbW9kdWxlSWRdOiBmYWN0b3J5IH0KICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBheWxvYWQgJiYgcGF5bG9hZFsxXSkgT2JqZWN0LmFzc2lnbihyZWdpc3RyeSwgcGF5bG9hZFsxXSk7CiAgICAgICAgICAgICAgICAgICAgfQoKICAgICAgICAgICAgICAgICAgICAvLyAyKSBBIG1pbmltYWwgX193ZWJwYWNrX3JlcXVpcmVfXyB3aXRoIGEgY2FjaGUgYW5kIGEgZmV3IGhlbHBlcnMKICAgICAgICAgICAgICAgICAgICBjb25zdCBjYWNoZSA9IHt9OwogICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uIHdyZXEoaWQpIHsKICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNhY2hlW2lkXSkgcmV0dXJuIGNhY2hlW2lkXS5leHBvcnRzOwogICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmYWN0b3J5ID0gcmVnaXN0cnlbaWRdOwogICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWZhY3RvcnkpIHRocm93IG5ldyBFcnJvcigiTm8gbW9kdWxlIHdpdGggaWQgIiArIGlkKTsKCiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG1vZHVsZSA9IHsgaWQsIGxvYWRlZDogZmFsc2UsIGV4cG9ydHM6IHt9IH07CiAgICAgICAgICAgICAgICAgICAgICAgIGNhY2hlW2lkXSA9IG1vZHVsZTsKCiAgICAgICAgICAgICAgICAgICAgICAgIC8vIE1pbmltYWwgaGVscGVycyB1c2VkIGJ5IG1hbnkgYnVuZGxlcwogICAgICAgICAgICAgICAgICAgICAgICB3cmVxLmQgPSAoZXhwb3J0cywgZGVmaW5pdGlvbikgPT4gewogICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gZGVmaW5pdGlvbikgewogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBrZXksIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBkZWZpbml0aW9uW2tleV0gfSk7CiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9CiAgICAgICAgICAgICAgICAgICAgICAgIH07CiAgICAgICAgICAgICAgICAgICAgICAgIHdyZXEuciA9IChleHBvcnRzKSA9PiB7CiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIFN5bWJvbCAhPT0gInVuZGVmaW5lZCIgJiYgU3ltYm9sLnRvU3RyaW5nVGFnKSB7CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFN5bWJvbC50b1N0cmluZ1RhZywgeyB2YWx1ZTogIk1vZHVsZSIgfSk7CiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICJfX2VzTW9kdWxlIiwgeyB2YWx1ZTogdHJ1ZSB9KTsKICAgICAgICAgICAgICAgICAgICAgICAgfTsKICAgICAgICAgICAgICAgICAgICAgICAgd3JlcS5uID0gKG1vZCkgPT4gewogICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZ2V0dGVyID0gbW9kICYmIG1vZC5fX2VzTW9kdWxlID8gKCkgPT4gbW9kLmRlZmF1bHQgOiAoKSA9PiBtb2Q7CiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3cmVxLmQoZ2V0dGVyLCB7IGE6IGdldHRlciB9KTsKICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBnZXR0ZXI7CiAgICAgICAgICAgICAgICAgICAgICAgIH07CiAgICAgICAgICAgICAgICAgICAgICAgIHdyZXEubyA9IChvYmosIHByb3ApID0+IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApOwoKICAgICAgICAgICAgICAgICAgICAgICAgLy8gMykgRXhlY3V0ZSB0aGUgbW9kdWxlIGZhY3Rvcnk6IChtb2R1bGUsIGV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pCiAgICAgICAgICAgICAgICAgICAgICAgIGZhY3RvcnkobW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgd3JlcSk7CgogICAgICAgICAgICAgICAgICAgICAgICBtb2R1bGUubG9hZGVkID0gdHJ1ZTsKICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1vZHVsZS5leHBvcnRzOwogICAgICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgICAgICB3ZWJwYWNrQ2h1bmtfdHdpdHRlcl9yZXNwb25zaXZlX3dlYlsxXVsxXVtpZF0oY2h1bmtzLCBjYWNoZSwgd3JlcSk7CiAgICAgICAgICAgICAgICAgICAgc29sdmVyID0gd2luZG93Ll9DSEFMTEVOR0UoKSgpOwogICAgICAgICAgICAgICAgICAgIGV2ZW50LnNvdXJjZS5wb3N0TWVzc2FnZSh7IGFjdGlvbjogJ3JlYWR5JyB9LCAiKiIpOwogICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkgewogICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZSk7CiAgICAgICAgICAgICAgICAgICAgZXZlbnQuc291cmNlLnBvc3RNZXNzYWdlKHsgYWN0aW9uOiAnaW5pdEVycm9yJywgZXJyb3I6IFN0cmluZyhlKSB9LCAiKiIpOwogICAgICAgICAgICAgICAgICAgIGluaXRFcnJvciA9IHRydWU7CiAgICAgICAgICAgICAgICB9CiAgICAgICAgICAgIH0gZWxzZSBpZiAoZGF0YS5hY3Rpb24gPT09ICdzb2x2ZScpIHsKICAgICAgICAgICAgICAgIGlmIChpbml0RXJyb3IpIHsKICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdJbml0aWFsaXphdGlvbiBlcnJvcicpOwogICAgICAgICAgICAgICAgICAgIGV2ZW50LnNvdXJjZS5wb3N0TWVzc2FnZSh7IGFjdGlvbjogJ2Vycm9yJywgZXJyb3I6ICdJbml0aWFsaXphdGlvbiBlcnJvcicsIGlkOiBkYXRhLmlkIH0sICIqIik7CiAgICAgICAgICAgICAgICAgICAgcmV0dXJuOwogICAgICAgICAgICAgICAgfQogICAgICAgICAgICAgICAgaWYgKCFzb2x2ZXIpIHsKICAgICAgICAgICAgICAgICAgICBhd2FpdCBzbGVlcCg1MCk7CiAgICAgICAgICAgICAgICAgICAgaWYgKCFzb2x2ZXIpIHsKICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgc2xlZXAoMTAwKTsKICAgICAgICAgICAgICAgICAgICB9CiAgICAgICAgICAgICAgICAgICAgaWYgKCFzb2x2ZXIpIHsKICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgc2xlZXAoNTAwKTsKICAgICAgICAgICAgICAgICAgICB9CiAgICAgICAgICAgICAgICAgICAgaWYgKCFzb2x2ZXIpIHsKICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgc2xlZXAoMTAwMCk7CiAgICAgICAgICAgICAgICAgICAgfQogICAgICAgICAgICAgICAgICAgIGlmICghc29sdmVyKSB7CiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHNsZWVwKDI1MDApOwogICAgICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgICAgICBpZiAoaW5pdEVycm9yIHx8ICFzb2x2ZXIpIHsKICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignU29sdmVyIG5vdCBpbml0aWFsaXplZCcpOwogICAgICAgICAgICAgICAgICAgICAgICBldmVudC5zb3VyY2UucG9zdE1lc3NhZ2UoeyBhY3Rpb246ICdlcnJvcicsIGVycm9yOiAnU29sdmVyIHRpbWVkIG91dCcsIGlkOiBkYXRhLmlkIH0sICIqIik7CiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjsKICAgICAgICAgICAgICAgICAgICB9CiAgICAgICAgICAgICAgICB9CiAgICAgICAgICAgICAgICB0cnkgewogICAgICAgICAgICAgICAgICAgIGxldCByZXN1bHQgPSBhd2FpdCBzb2x2ZXIoZGF0YS5wYXRoLCBkYXRhLm1ldGhvZCk7CiAgICAgICAgICAgICAgICAgICAgZXZlbnQuc291cmNlLnBvc3RNZXNzYWdlKHsgYWN0aW9uOiAnc29sdmVkJywgcmVzdWx0LCBpZDogZGF0YS5pZCB9LCAiKiIpOwogICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkgewogICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1NvbHZlciBlcnJvcjonLCBlKTsKICAgICAgICAgICAgICAgICAgICBldmVudC5zb3VyY2UucG9zdE1lc3NhZ2UoeyBhY3Rpb246ICdlcnJvcicsIGVycm9yOiBgJHtlLm1lc3NhZ2V9XG4ke2Uuc3RhY2t9YCwgaWQ6IGRhdGEuaWQgfSwgIioiKTsKICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgfQogICAgICAgIH0pOwogICAgPC9zY3JpcHQ+CjwvYm9keT4KCjwvaHRtbD4=';

function createSolverFrame() {
    if (solverIframe) solverIframe.remove();
    solverIframe = document.createElement("iframe");
    //display:none causes animations to not play which breaks the challenge solver, so have to hide it in different way
    solverIframe.style.position = "absolute";
    solverIframe.width = "0px";
    solverIframe.height = "0px";
    solverIframe.style.border = "none";
    solverIframe.style.opacity = 0;
    solverIframe.style.pointerEvents = "none";
    solverIframe.tabIndex = -1;
    // srcdoc: no fetch needed, inherits x.com origin, eval works, postMessage is same-origin
    solverIframe.srcdoc = atob(SANDBOX_B64);
    console.log('[OT Challenge] solver iframe srcdoc set');
    let injectedBody = document.getElementById("injected-body");
    if (injectedBody) {
        injectedBody.appendChild(solverIframe);
    } else {
        let int = setInterval(() => {
            let injectedBody = document.getElementById("injected-body");
            if (injectedBody) {
                injectedBody.appendChild(solverIframe);
                clearInterval(int);
            }
        }, 10);
    }
}
createSolverFrame();

function solveChallenge(path, method) {
    return new Promise((resolve, reject) => {
        if (solverErrored) {
            reject("Solver errored during initialization");
            return;
        }
        let id = solveId++;
        solveCallbacks[id] = { resolve, reject, time: Date.now() };
        if (!solverReady || !solverIframe || !solverIframe.contentWindow) {
            solveQueue.push({ id, path, method });
        } else {
            try {
                solverIframe.contentWindow.postMessage(
                    { action: "solve", id, path, method },
                    "*"
                );
            } catch (e) {
                console.error(`Error sending challenge to solver:`, e);
                reject(e);
            }
            // setTimeout(() => {
            //     if(solveCallbacks[id]) {
            //         solveCallbacks[id].reject('Solver timed out');
            //         delete solveCallbacks[id];
            //     }
            // }, 1750);
        }
    });
}

setInterval(() => {
    if (
        !document.getElementById("loading-box").hidden &&
        sentData &&
        solveQueue.length
    ) {
        console.log(
            "Something's wrong with the challenge solver, reloading",
            solveQueue
        );
        createSolverFrame();
        initChallenge();
    }
}, 2000);

window.addEventListener("message", (e) => {
    console.log('[OT Challenge] window message received, origin:', e.origin, 'action:', e.data && e.data.action);
    if (e.source !== solverIframe.contentWindow) { console.log('[OT Challenge] message not from solver iframe, ignoring'); return; }
    let data = e.data;
    if (data.action === "solved" && typeof data.id === "number") {
        let { id, result } = data;
        if (solveCallbacks[id]) {
            solveCallbacks[id].resolve(result);
            delete solveCallbacks[id];
        }
    } else if (data.action === "error" && typeof data.id === "number") {
        let { id, error } = data;
        if (solveCallbacks[id]) {
            solveCallbacks[id].reject(error);
            delete solveCallbacks[id];
        }
    } else if (data.action === "initError") {
        solverErrored = true;
        for (let id in solveCallbacks) {
            solveCallbacks[id].reject("Solver errored during initialization");
            delete solveCallbacks[id];
        }
        alert(
            `There was an error in initializing security header generator:\n${data.error}\nUser Agent: ${navigator.userAgent}\nOldTwitter doesn't allow unsigned requests anymore for your account security.`
        );
        console.error("Error initializing solver:");
        console.error(data.error);
    } else if (data.action === "ready") {
        solverReady = true;
        for (let task of solveQueue) {
            solverIframe.contentWindow.postMessage(
                {
                    action: "solve",
                    id: task.id,
                    path: task.path,
                    method: task.method,
                },
                "*"
            );
        }
    }
});

window._fetch = window.fetch;
fetch = async function (url, options) {
    if (
        !url.startsWith("/i/api") &&
        !url.startsWith("https://api.twitter.com") &&
        !url.startsWith("https://api.x.com")
    )
        return _fetch(url, options);
    if (!options) options = {};
    if (!options.headers) options.headers = {};
    if (!options.headers["x-twitter-auth-type"]) {
        options.headers["x-twitter-auth-type"] = "OAuth2Session";
    }
    if (!options.headers["x-twitter-active-user"]) {
        options.headers["x-twitter-active-user"] = "yes";
    }
    if (!options.headers["X-Client-UUID"]) {
        options.headers["X-Client-UUID"] = OLDTWITTER_CONFIG.deviceId;
    }
    if (!url.startsWith("http:") && !url.startsWith("https:")) {
        let host = location.hostname;
        if (!["x.com", "twitter.com"].includes(host)) host = "x.com";
        if (!url.startsWith("/")) url = "/" + url;
        url = `https://${host}${url}`;
    }
    let parsedUrl = new URL(url);
    // try {
    let solved = await solveChallenge(
        parsedUrl.pathname,
        options.method ? options.method.toUpperCase() : "GET"
    );
    options.headers["x-client-transaction-id"] = solved;
    // } catch (e) {
    //     console.error(`Error solving challenge for ${url}:`);
    //     console.error(e);
    // }
    if (
        options.method &&
        options.method.toUpperCase() === "POST" &&
        typeof options.body === "string"
    ) {
        options.headers["Content-Length"] = options.body.length;
    }

    return _fetch(url, options);
};

async function initChallenge() {
    try {
        let homepageData;
        let sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        let host = location.hostname;
        if (!["x.com", "twitter.com"].includes(host)) host = "x.com";
        console.log('[OT Challenge] initChallenge: fetching homepage from', host);
        try {
            homepageData = await _fetch(`https://${host}/`).then((res) =>
                res.text()
            );
        } catch (e) {
            console.warn('[OT Challenge] homepage fetch attempt 1 failed:', e && e.message, '— retrying');
            await sleep(500);
            try {
                homepageData = await _fetch(`https://${host}/`).then((res) =>
                    res.text()
                );
            } catch (e) {
                throw new Error("Failed to fetch homepage: " + e);
            }
        }
        console.log('[OT Challenge] homepage fetched, length:', homepageData.length);
        let dom = new DOMParser().parseFromString(homepageData, "text/html");
        let verificationKey = dom.querySelector(
            'meta[name="twitter-site-verification"]'
        ).content;
        let anims = Array.from(
            dom.querySelectorAll('svg[id^="loading-x"]')
        ).map((svg) => svg.outerHTML);

        let vendorCode = homepageData.match(/vendor.(\w+).js"/)[1];
        let challengePos = homepageData.match(/(\d+):"ondemand.s"/)[1];
        let challengeCode = homepageData.match(new RegExp(`${challengePos}:"(\\w+)"`))[1];
        console.log('[OT Challenge] vendorCode:', vendorCode, 'challengeCode:', challengeCode);

        OLDTWITTER_CONFIG.verificationKey = verificationKey;

        function sendInit() {
            sentData = true;
            console.log('[OT Challenge] sendInit called, iframe contentWindow:', !!solverIframe?.contentWindow);
            if (!solverIframe || !solverIframe.contentWindow)
                return setTimeout(sendInit, 50);
            console.log('[OT Challenge] posting init to iframe');
            solverIframe.contentWindow.postMessage(
                {
                    action: "init",
                    challengeCode,
                    vendorCode,
                    anims,
                    verificationCode: OLDTWITTER_CONFIG.verificationKey,
                },
                "*"
            );
        }
        setTimeout(sendInit, 50);
        return true;
    } catch (e) {
        console.error(`Error during challenge init:`);
        console.error(e);
        if (location.hostname === "twitter.com") {
            alert(
                `There was an error in initializing security header generator: ${e}\nUser Agent: ${navigator.userAgent}\nOldTwitter doesn't allow unsigned requests anymore for your account security. Currently the main reason for this happening is social network tracker protection blocking the script. Try disabling such settings in your browser and extensions that do that and refresh the page. This also might be because you're either not logged in or using twitter.com instead of x.com.`
            );
        } else {
            alert(
                `There was an error in initializing security header generator: ${e}\nUser Agent: ${navigator.userAgent}\nOldTwitter doesn't allow unsigned requests anymore for your account security. Currently the main reason for this happening is social network tracker protection blocking the script. Try disabling such settings in your browser and extensions that do that and refresh the page. This can also happen if you're not logged in.`
            );
        }
        return false;
    }
}

initChallenge();
