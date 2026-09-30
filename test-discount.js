fetch("https://api.gmaxstudioz.com/api/studio/getAll")
  .then(res => res.json())
  .then(async data => {
      console.log("Studios:", data.items.length);
      for (const item of data.items) {
          const res = await fetch("https://api.gmaxstudioz.com/api/studio/get/" + item.slug, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ slug: item.slug })
          });
          const studio = await res.json();
          console.log("Studio name:", studio.name);
          console.log("Categories:", studio.categories.length);
          let hasDisc = false;
          (studio.categories || []).forEach(c => {
              (c.services || []).forEach(s => {
                  if (s.discountPercentage > 0) {
                      console.log("  Service with discount:", s.name, s.discountPercentage);
                      hasDisc = true;
                  }
              });
          });
          (studio.addons || []).forEach(a => {
              if (a.discountPercentage > 0) {
                  console.log("  Addon with discount:", a.name, a.discountPercentage);
                  hasDisc = true;
              }
          });
      }
  })
  .catch(console.error);
