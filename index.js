const axios = require("axios");
axios.defaults.timeout = 1000;

const sjacademyUrl =
  "http://sjacademy-dev.eba-xcedb4mk.us-west-2.elasticbeanstalk.com/graphql";

exports.handler = async (event) => {
  try {
    const token = await login();
    await updateCoursesPrices(token);
  } catch (thrownError) {
    console.log("Error", thrownError);
  }
  const response = {
    statusCode: 200,
    body: JSON.stringify("SjAcademy update prices function"),
  };
  return response;
};

const login = async () => {
  // const email = "sjacademy-app@mail.com";
  // const password = "sjacademy-app";
  const email = "s@mail.com";
  const password = "123";

  const query = `
  mutation {
    login(email:"${email}",password:"${password}"){
      access_token
    }
  }`;

  try {
    const { data } = await axios.post(sjacademyUrl, {
      query,
    });

    const token = data.data?.login?.access_token;

    if (!token) {
      throw new Error(JSON.stringify(data));
    }

    return token;
  } catch (thrownError) {
    throw thrownError;
  }
};

const updateCoursesPrices = async (token) => {
  try {
    const usdExchange = await getUsdExchange();
    let courses = await getCourses(token);
    courses = courses
      .map((course) => {
        const addToPrice = calcDifCoursePrice(course, usdExchange);
        if (addToPrice > 0) {
          course.price = course.price + addToPrice;
          return course;
        } else {
          return false;
        }
      })
      .filter((course) => course);

    try {
      const updatedCourses = await updateCourses(token, courses);
      courses.forEach((course) => {
        const key = `ID_${course._id}`;

        console.log(
          "Updated:",
          updatedCourses[key]._id,
          updatedCourses[key].price,
          course.price
        );
      });
    } catch (thrownError) {
      console.log("Update error", thrownError);
    }
  } catch (thrownError) {
    throw thrownError;
  }
};

const getCourses = async (token) => {
  const query = `
  {
    courses{
        _id
        price
    }
  }`;

  try {
    const { data } = await axios.post(sjacademyUrl, {
      query,
    });

    const { errors } = data;

    if (errors) {
      throw new Error(JSON.stringify(errors));
    }

    return data.data.courses;
  } catch (thrownError) {
    throw thrownError;
  }
};

const getUsdExchange = async () => {
  try {
    const { data } = await axios.get(
      "https://openexchangerates.org/api/latest.json?app_id=49aadff555684f1f9d3e68d2c45ec6b3"
    );

    const { error } = data;

    if (error) {
      throw new Error(JSON.stringify(data));
    }

    const { rates } = data;

    return rates;
  } catch (thrownError) {
    throw thrownError;
  }
};

const calcDifCoursePrice = (course, usdExchange) => {
  // This calc can by more complex

  const { ARS: usdArsRate } = usdExchange;
  const spectedPrice = 10 * usdArsRate;

  let addToPrice = 0;

  if (course.price < spectedPrice) {
    addToPrice = spectedPrice - course.price;
  }

  return addToPrice;
};

const updateCourses = async (token, courses) => {
  const config = {
    headers: { Authorization: `Bearer ${token}` },
  };

  if (courses.length == 0) {
    return [];
  }

  const query = getUpdateCoursesQuery(courses);

  try {
    const { data } = await axios.post(
      sjacademyUrl,
      {
        query,
      },
      config
    );

    const { errors } = data;

    if (errors) {
      throw new Error(JSON.stringify(errors));
    }

    return data.data;
  } catch (thrownError) {
    throw thrownError;
  }
};

const getUpdateCoursesQuery = (courses) => {
  let query = `
  mutation {`;

  courses.forEach((course) => {
    query += `
    ID_${course._id}:updateCourse (updateCourseInput:{_id: "${course._id}",price: ${course.price}}){
      _id
      price
    }`;
  });

  query += `}`;

  return query;
};
exports.handler();
