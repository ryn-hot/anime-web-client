import guessit from "guessit-exec";

guessit('South.Park.s01.e01.720.mkv')
.then((data) => {
  console.log(data);
})
.catch((e) => {
  console.log(e);
});