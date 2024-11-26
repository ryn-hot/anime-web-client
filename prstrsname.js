import guessit from "guessit-exec";

guessit('')
.then((data) => {
  console.log(data);
})
.catch((e) => {
  console.log(e);
});