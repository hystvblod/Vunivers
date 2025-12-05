// VRealms - engine/endings.js
// Affiche une fin en fonction de la jauge qui a explosé (0 ou 100).

(function () {
  const VREndings = {
    async showEnding(universeId, lang) {
      const cause = window.VRState && window.VRState.lastDeath;
      if (!cause) {
        // fallback générique
        window.VRUIBinding.showEnding(
          "Fin du règne",
          "Une de tes jauges a atteint une extrémité. Ton règne s'achève."
        );
        return;
      }

      const key =
        cause.gaugeId + "_" + (cause.direction === "down" ? "0" : "100");

      try {
        // 1) mapping logique (gauge + direction -> id de fin)
        const mapRes = await fetch(`data/endings/${universeId}.json`, {
          cache: "no-cache"
        });
        if (!mapRes.ok) throw new Error("endings mapping not found");
        const mapping = await mapRes.json();
        const endingId = mapping[key];

        if (!endingId) {
          window.VRUIBinding.showEnding(
            "Fin du règne",
            "Ton règne s'achève dans le tumulte. Aucun destin particulier n'a été écrit pour cette fin."
          );
          return;
        }

        // 2) textes FR des fins
        const endRes = await fetch(`data/i18n/endings_${lang}.json`, {
          cache: "no-cache"
        });
        if (!endRes.ok) throw new Error("endings texts not found");
        const endingsTexts = await endRes.json();
        const data = endingsTexts[endingId];

        if (!data) {
          window.VRUIBinding.showEnding(
            "Fin du règne",
            "Ton règne s'achève, mais aucun texte n'a encore été gravé pour cette fin."
          );
          return;
        }

        window.VRUIBinding.showEnding(data.title, data.body);
      } catch (e) {
        console.error("[VREndings] Erreur chargement fin:", e);
        window.VRUIBinding.showEnding(
          "Fin du règne",
          "Ton règne s'achève dans le silence d'un bug. L'Enfer rit doucement."
        );
      }
    }
  };

  window.VREndings = VREndings;
})();
