const fs = require('fs');

let dashCode = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const oldRenderText = `                  ) : (
                    task2Text || "No order note generated."
                  )`;

const newRenderText = `                  ) : (
                    (() => {
                      if (!task2Text) return "No order note generated.";
                      if (substituteStatus === 'accepted' && task1Data) {
                        // Dynamically replace the at-risk ingredient in the text with the recommended substitute
                        let updatedText = task2Text;
                        if (task1Data.ingredient_at_risk === 'Refined Frying Oil') {
                          updatedText = updatedText.replace(/Refined Frying Oil/gi, task1Data.recommended_substitute);
                        } else {
                          updatedText = updatedText.replace(new RegExp(task1Data.ingredient_at_risk, 'gi'), task1Data.recommended_substitute);
                        }
                        return updatedText;
                      }
                      return task2Text;
                    })()
                  )`;

dashCode = dashCode.replace(oldRenderText, newRenderText);

fs.writeFileSync('src/components/Dashboard.tsx', dashCode);
console.log('Updated Dashboard.tsx for dynamic text replacement');
