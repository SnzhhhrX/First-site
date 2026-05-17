const TOKEN = "8991083132:AAFn117gm6TpcPeziFC3nnKwgxNYDJf4AUI";
const CHAT_ID = "7381554878";

function getCount() {
    return Number(localStorage.getItem("bookingCount")) || 0;
}

function setCount(value) {
    localStorage.setItem("bookingCount", value);
}

document.getElementById("bookingForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    let count = getCount();

    // ❌ ЛИМИТ 3 ЗАЯВКИ
    if (count >= 3) {
        alert("Ты уже отправил максимум 3 заявки!");
        return;
    }

    const name = document.getElementById("name").value;
    const phone = document.getElementById("phone").value;
    const guests = document.getElementById("guests").value;
    const datetime = document.getElementById("datetime").value;

    const message = 
`🍽️ Новая бронь:

👤 Имя: ${name}
📞 Телефон: ${phone}
👥 Гостей: ${guests}
🕒 Время: ${datetime}

📊 Заявка №${count + 1} из 3`;

    try {
        await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: message
            })
        });

        count++;
        setCount(count);

        document.getElementById("formMessage").style.display = "block";
        document.getElementById("formMessage").innerText = 
            `Заявка отправлена (${count}/3)`;

        document.getElementById("bookingForm").reset();

    } catch (error) {
        alert("Ошибка отправки");
        console.log(error);
    }
});