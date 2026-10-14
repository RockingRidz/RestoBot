const fs = require('fs');

let dashCode = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const oldCopy = `  const handleCopy = () => {
    if (task2Text) {
      navigator.clipboard.writeText(task2Text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };`;

const newCopy = `  const handleCopy = () => {
    if (task2Text) {
      let textToCopy = task2Text;
      if (substituteStatus === 'accepted' && task1Data) {
        if (task1Data.ingredient_at_risk === 'Refined Frying Oil') {
          textToCopy = textToCopy.replace(/Refined Frying Oil/gi, task1Data.recommended_substitute);
        } else {
          textToCopy = textToCopy.replace(new RegExp(task1Data.ingredient_at_risk, 'gi'), task1Data.recommended_substitute);
        }
      }
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };`;

dashCode = dashCode.replace(oldCopy, newCopy);

fs.writeFileSync('src/components/Dashboard.tsx', dashCode);
console.log('Updated Dashboard.tsx for copy dynamic text');
